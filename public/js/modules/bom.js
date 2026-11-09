// =========================================================
// UBM - Bill of Materials (BOM) & PR Picker Module
// =========================================================

// Helper: Memeriksa apakah order bertipe Jasa / Layanan (Non-BOM)
function isServiceOrder(order) {
  if (!order) return false;
  if (order.quotationId) {
    const quo = (state.quotations || []).find(q => q.id === order.quotationId);
    if (quo) {
      if (quo.quotationType === 'produk') return false;
      if (quo.quotationType === 'jasa') return true;
    }
  }
  if (order.quotationType === 'produk' || order.orderType === 'produk') return false;
  if (order.quotationType === 'jasa' || order.orderType === 'jasa') return true;
  if (order.notes) {
    const lower = order.notes.toLowerCase();
    if (lower.includes('surat penawaran harga (produk)') || lower.includes('[tipe: produk]')) return false;
    if (
      lower.includes('surat penawaran harga (jasa)') ||
      lower.includes('[tipe: jasa]') ||
      lower.includes('tipe penawaran: jasa')
    ) return true;
  }
  return false;
}

let currentPRPickerItems = [];
let currentBOMTab = 'orders';

function handleCreateMasterBOMClick() {
  if (typeof canUserCreateMasterBOM === 'function' && !canUserCreateMasterBOM()) {
    showToast('⚠️ Member tidak memiliki akses untuk membuat Master BOM. Master BOM hanya bisa dibuat oleh Administrator, Lead Project, dan Ketua UBM.', 'warning');
    return;
  }
  openBOMPage();
}
window.handleCreateMasterBOMClick = handleCreateMasterBOMClick;

function switchBOMTab(tab) {
  currentBOMTab = tab;
  const ordersTab = document.getElementById('bom-tab-orders-content');
  const masterTab = document.getElementById('bom-tab-master-content');
  const ordersBtn = document.getElementById('tab-btn-bom-orders');
  const masterBtn = document.getElementById('tab-btn-bom-master');

  if (tab === 'orders') {
    if (ordersTab) ordersTab.style.display = 'block';
    if (masterTab) masterTab.style.display = 'none';
    if (ordersBtn) ordersBtn.classList.add('active');
    if (masterBtn) masterBtn.classList.remove('active');
    renderBOMPendingOrders();
  } else {
    if (ordersTab) ordersTab.style.display = 'none';
    if (masterTab) masterTab.style.display = 'block';
    if (ordersBtn) ordersBtn.classList.remove('active');
    if (masterBtn) masterBtn.classList.add('active');
    renderBOMMasterListTable();
  }

  updateBOMTabBadges();
  if (window.lucide) lucide.createIcons();
}

function updateBOMTabBadges() {
  const badgeOrders = document.getElementById('badge-tab-bom-orders-count');
  const badgeMaster = document.getElementById('badge-tab-bom-master-count');

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const roleName = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : 'Administrator';

  if (badgeMaster) {
    let masterList = [...(state.bom || [])];
    if (roleName === 'Member') {
      masterList = masterList.filter(b => {
        if (b.orderId || b.projectId) {
          return typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(b.orderId || b.projectId, activeUser) : false;
        }
        const userProjects = (state.projects || []).filter(p => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(p, activeUser) : false);
        return userProjects.some(p =>
          p.bomId === b.id ||
          (p.projectName && b.productName && p.projectName.toLowerCase().trim() === b.productName.toLowerCase().trim()) ||
          (p.projectName && b.projectName && p.projectName.toLowerCase().trim() === b.projectName.toLowerCase().trim())
        );
      });
    }
    const acceptedTemplatesCount = masterList.filter(b => b.status === 'Accepted').length;
    badgeMaster.textContent = acceptedTemplatesCount;
  }

  if (badgeOrders) {
    let orderItemsCount = 0;
    let ordersList = (state.orders || []).filter(o => !isServiceOrder(o));
    if (roleName === 'Member') {
      ordersList = ordersList.filter(o => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(o.id, activeUser) : true);
    }
    ordersList.forEach(o => {
      (o.items || []).forEach(item => {
        const itemNameClean = (item.itemName || '').toLowerCase().trim();
        const boms = (state.bom || []).filter(b => b.orderId === o.id || (b.productName && (b.productName || '').toLowerCase().trim() === itemNameClean));
        orderItemsCount += Math.max(1, boms.length);
      });
    });
    badgeOrders.textContent = orderItemsCount;
  }
}

function renderBOMTable() {
  renderBOMPendingOrders();
  renderBOMMasterListTable();
  updateBOMTabBadges();
  if (window.lucide) lucide.createIcons();
}

function renderBOMMasterListTable() {
  const tbody = document.getElementById('table-bom-body');
  if (!tbody) return;

  // Kontrol tombol 'Buat Master BOM' sesuai hak akses (Admin, Ketua UBM, Lead Project)
  const createMasterBtn = document.getElementById('btn-create-master-bom');
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const userRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || 'Member');
  const canCreateMaster = typeof canUserCreateMasterBOM === 'function' ? canUserCreateMasterBOM(activeUser) : true;

  if (createMasterBtn) {
    if (!canCreateMaster) {
      createMasterBtn.setAttribute('disabled', 'true');
      createMasterBtn.style.opacity = '0.45';
      createMasterBtn.style.cursor = 'not-allowed';
      createMasterBtn.title = 'Akses Terkunci: Master BOM hanya bisa dibuat oleh Administrator, Lead Project, dan Ketua UBM';
      createMasterBtn.onclick = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        showToast('⚠️ Member tidak memiliki akses untuk membuat Master BOM. Master BOM hanya bisa dibuat oleh Administrator, Lead Project, dan Ketua UBM.', 'warning');
      };
    } else {
      createMasterBtn.removeAttribute('disabled');
      createMasterBtn.style.opacity = '1';
      createMasterBtn.style.cursor = 'pointer';
      createMasterBtn.title = 'Buat Master BOM Baru';
      createMasterBtn.onclick = () => openBOMPage();
    }
  }

  (state.bom || []).forEach(b => {
    if (typeof ensureBOMProjectData === 'function') ensureBOMProjectData(b);
  });

  let list = [...(state.bom || [])];

  // Role Member: hanya melihat Master BOM yang terkait dengan project yang di-assign padanya
  if (userRole === 'Member') {
    list = list.filter(b => {
      if (b.orderId || b.projectId) {
        return typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(b.orderId || b.projectId, activeUser) : false;
      }
      const userProjects = (state.projects || []).filter(p => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(p, activeUser) : false);
      return userProjects.some(p =>
        p.bomId === b.id ||
        (p.projectName && b.productName && p.projectName.toLowerCase().trim() === b.productName.toLowerCase().trim()) ||
        (p.projectName && b.projectName && p.projectName.toLowerCase().trim() === b.projectName.toLowerCase().trim())
      );
    });
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(b => 
      b.id.toLowerCase().includes(q) || 
      b.productName.toLowerCase().includes(q) ||
      (b.productCode && b.productCode.toLowerCase().includes(q)) ||
      (b.category && b.category.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    if (userRole === 'Member') {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted" style="padding: 36px;"><p style="font-size: 13.5px; font-weight: 600; color: #475569; margin-bottom: 4px;">Belum Ada Template BOM untuk Project Anda</p><p style="font-size: 12px; color: #94a3b8; margin: 0;">Tidak ada formula Master BOM yang terkait dengan project yang ditugaskan ke Anda.</p></td></tr>';
    } else {
      tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted" style="padding: 28px;">Belum ada Template Master BOM tersimpan. Klik tombol <b>+ Buat Master BOM</b> di atas untuk membuat template baru.</td></tr>';
    }
    return;
  }

  tbody.innerHTML = list.map(bom => {
    const totalComponents = bom.components?.length || 0;
    const materialCost = bom.materialCost !== undefined ? Number(bom.materialCost) :
      (bom.components || []).reduce((sum, c) => sum + ((Number(c.qty) || 0) * (Number(c.unitCost) || 0)), 0);
    const labor = Number(bom.laborCost) || 0;
    const overhead = Number(bom.overheadCost) || 0;
    const totalHPP = bom.totalEstimatedCost !== undefined ? Number(bom.totalEstimatedCost) : (materialCost + labor + overhead);

    const refOrderHtml = bom.orderId ?
      `<span class="mono-id font-sm text-primary font-bold" style="font-size: 11px;">${escapeHtml(bom.orderId)}</span>${bom.customerName ? `<div class="text-muted font-xs" style="font-size: 10px;">${escapeHtml(bom.customerName)}</div>` : ''}` :
      `<span class="text-muted font-sm" style="font-size: 11px;">Template Standar</span>`;

    const currentStatus = bom.status || 'Pengajuan';
    const isAccepted = currentStatus === 'Accepted';
    const isDitolak = currentStatus === 'Ditolak';

    const statusColorStyle = isAccepted
      ? 'border: 1.5px solid #10b981; color: #047857; background: #ecfdf5;'
      : (isDitolak
          ? 'border: 1.5px solid #ef4444; color: #b91c1c; background: #fef2f2;'
          : 'border: 1.5px solid #f59e0b; color: #b45309; background: #fffbeb;');

    const canApproveBOM = typeof hasRolePermission === 'function'
      ? hasRolePermission('canApproveBOM')
      : ['Administrator', 'Wakil Direktur I', 'Ketua UBM', 'Keuangan'].includes(userRole);

    const statusBadgeHtml = canApproveBOM ? `
      <select class="form-control form-control-sm" style="font-size: 11px; padding: 2px 6px; font-weight: 700; border-radius: 6px; cursor: pointer; width: auto; display: inline-block; ${statusColorStyle}" onclick="event.stopPropagation()" onchange="event.stopPropagation(); changeOrderBOMStatus('${bom.orderId || ''}', '${bom.id}', this.value)">
        <option value="Pengajuan" ${currentStatus === 'Pengajuan' ? 'selected' : ''}>🟡 Pengajuan</option>
        <option value="Accepted" ${isAccepted ? 'selected' : ''}>🟢 Accepted</option>
        <option value="Ditolak" ${isDitolak ? 'selected' : ''}>🔴 Tolak</option>
      </select>
    ` : `
      <span class="badge" style="font-size: 11px; padding: 4px 8px; font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; ${statusColorStyle}">
        ${isAccepted ? '🟢 Accepted' : (isDitolak ? '🔴 Tolak' : '🟡 Pengajuan')}
      </span>
    `;

    const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(bom.orderId || bom.projectId, activeUser) : false;
    const canEditOrDelete = (userRole === 'Administrator' || userRole === 'Ketua UBM' || userRole === 'Wakil Direktur I' || isLead);

    const actionButtonsHtml = canEditOrDelete ? `
      <div class="table-actions">
        <button class="btn-icon" style="color: #2563eb;" title="Lihat Struktur BOM" onclick="event.stopPropagation(); viewBOMDetail('${bom.id}')"><i data-lucide="eye"></i></button>
        ${!isAccepted ? `<button class="btn-icon" style="color: #4f46e5;" title="Edit Template BOM" onclick="event.stopPropagation(); editBOM('${bom.id}')"><i data-lucide="edit-2"></i></button>` : ''}
        <button class="btn-icon btn-danger-ghost" title="Hapus Template BOM" onclick="event.stopPropagation(); deleteResource('bom', '${bom.id}')"><i data-lucide="trash-2"></i></button>
      </div>
    ` : `
      <div class="table-actions">
        <button class="btn-icon" style="color: #2563eb;" title="Lihat Struktur BOM" onclick="event.stopPropagation(); viewBOMDetail('${bom.id}')"><i data-lucide="eye"></i></button>
      </div>
    `;

    return `
      <tr style="cursor: pointer;" onclick="viewBOMDetail('${bom.id}')" title="Klik baris untuk melihat detail struktur Template BOM">
        <td class="mono-id">${escapeHtml(bom.id)}</td>
        <td>${refOrderHtml}</td>
        <td>
          <div class="font-bold text-main">${escapeHtml(bom.productName)}</div>
          <div class="text-muted font-sm" style="font-size: 11px;">Kode: ${escapeHtml(bom.productCode || '-')}</div>
        </td>
        <td><span class="badge badge-purple">${escapeHtml(bom.category || 'General')}</span></td>
        <td style="text-align: center;"><span class="badge badge-outline font-mono font-bold" style="font-size: 10.5px;">${escapeHtml(bom.revision || 'v1.0')}</span></td>
        <td style="text-align: center;"><span class="badge badge-secondary font-bold" style="font-size: 10.5px;">${totalComponents} Item</span></td>
        <td class="font-mono text-muted" style="font-size: 12px;">${formatRupiah(materialCost)}</td>
        <td class="font-bold font-mono text-emerald" style="font-size: 12px;">${formatRupiah(totalHPP)}</td>
        <td style="text-align: center;">${statusBadgeHtml}</td>
        <td class="text-right">
          ${actionButtonsHtml}
        </td>
      </tr>
    `;
  }).join('');
}

// ---------------- STOCK MANAGEMENT HELPERS (SYNC WITH PURCHASING) ----------------
async function restoreBOMComponentsStock(components) {
  if (!components || !Array.isArray(components) || components.length === 0) return;
  const prUpdateMap = new Map();

  components.forEach(comp => {
    const qtyToRestore = parseFloat(comp.qty) || 0;
    if (qtyToRestore <= 0) return;

    let pr = (state.purchasing || []).find(p => p.id === comp.prId);
    if (!pr) {
      pr = (state.purchasing || []).find(p =>
        (p.status === 'Disetujui' || p.status === 'Stock' || p.status === 'Approved') &&
        (p.items || []).some(it => (it.itemName || '').toLowerCase().trim() === (comp.componentName || '').toLowerCase().trim() && it.itemStatus === 'Sesuai')
      );
    }

    if (pr && pr.items) {
      let targetItem = null;
      if (comp.itemIndex !== undefined && pr.items[comp.itemIndex] && pr.items[comp.itemIndex].itemStatus === 'Sesuai') {
        targetItem = pr.items[comp.itemIndex];
      }
      if (!targetItem) {
        targetItem = pr.items.find(i => 
          (i.itemName || '').toLowerCase().trim() === (comp.componentName || '').toLowerCase().trim() && i.itemStatus === 'Sesuai'
        ) || pr.items.find(i => (i.itemName || '').toLowerCase().trim() === (comp.componentName || '').toLowerCase().trim());
      }

      if (targetItem) {
        const currentStock = parseFloat(targetItem.qty) || 0;
        targetItem.qty = currentStock + qtyToRestore;
        const unitPrice = parseFloat(targetItem.purchasePrice !== undefined ? targetItem.purchasePrice : (targetItem.actualPrice !== undefined ? targetItem.actualPrice : (targetItem.estimatedPrice || targetItem.unitPrice || 0))) || 0;
        targetItem.total = targetItem.qty * unitPrice;
        pr.totalEstimated = pr.items.reduce((s, it) => s + (parseFloat(it.total) || 0), 0);
        prUpdateMap.set(pr.id, pr);
      }
    }
  });

  try {
    for (const [prId, prData] of prUpdateMap.entries()) {
      await fetch(`/api/purchasing/${prId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prData)
      });
    }
    if (typeof directSyncPurchasingTablesToSupabase === 'function') {
      await directSyncPurchasingTablesToSupabase().catch(e => console.warn(e));
    }
  } catch (err) {
    console.error('Error updating restored stock in server:', err);
  }
}

async function deductBOMComponentsStock(components) {
  if (!components || !Array.isArray(components) || components.length === 0) return;
  // Pengurangan stok inventory Master Barang dihitung secara riil dan dinamis:
  // Stok Tersedia = Total Masuk (PR Sesuai) - Digunakan di BOM + Pengembalian Laporan Proyek.
  // Ketika komponen ditambahkan ke BOM, komponen tersebut otomatis tercatat dalam pemakaian (usedInBom)
  // dan secara langsung mengurangi stok tersedia di Master Barang (Inventory).
  try {
    if (typeof directSyncPurchasingTablesToSupabase === 'function') {
      await directSyncPurchasingTablesToSupabase().catch(e => console.warn(e));
    }
  } catch (err) {
    console.error('Error syncing deducted stock in server:', err);
  }
}

async function changeOrderBOMStatus(orderId, bomId, newStatus) {
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const userRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || 'Member');
  const canApprove = (typeof hasRolePermission === 'function')
    ? hasRolePermission('canApproveBOM')
    : ['Administrator', 'Wakil Direktur I', 'Ketua UBM', 'Keuangan'].includes(userRole);

  if (!canApprove) {
    if (typeof showToast === 'function') {
      showToast('⚠️ Hanya Bagian Keuangan, Ketua UBM, dan Administrator yang memiliki wewenang untuk menyetujui / merubah Status BOM.', 'warning');
    }
    if (typeof renderBOMTable === 'function') renderBOMTable();
    return;
  }

  const bom = (state.bom || []).find(b => b.id === bomId);
  if (!bom) return;

  const prevStatus = bom.status || 'Pengajuan';
  const targetStatus = (newStatus === 'Accepted') ? 'Accepted' : ((newStatus === 'Ditolak' || newStatus === 'Tolak') ? 'Ditolak' : 'Pengajuan');

  if (prevStatus === targetStatus) return;

  bom.status = targetStatus;
  bom.updatedAt = new Date().toISOString();

  // Stok & HPP Management
  if (targetStatus === 'Accepted') {
    await deductBOMComponentsStock(bom.components);
    if (typeof window.syncBOMToProjectFinances === 'function') {
      await window.syncBOMToProjectFinances(bom);
    }
    const resolvedOrderId = orderId || bom.orderId;
    if (resolvedOrderId) {
      const targetOrder = (state.orders || []).find(o => o.id === resolvedOrderId);
      if (targetOrder && (targetOrder.status === 'Accepted' || targetOrder.status === 'Confirmed')) {
        targetOrder.status = 'In Production';
        targetOrder.updatedAt = new Date().toISOString();
        if (typeof directSupabaseUpsertNativeRow === 'function') {
          await directSupabaseUpsertNativeRow('orders', targetOrder).catch(() => {});
        }
        fetch(`/api/orders/${targetOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(targetOrder)
        }).catch(e => console.warn('Sync order status to In Production error:', e));
      }
    }
  } else if (targetStatus === 'Ditolak') {
    if (prevStatus === 'Accepted') {
      await restoreBOMComponentsStock(bom.components);
    }
  } else if (targetStatus === 'Pengajuan' && prevStatus === 'Accepted') {
    await restoreBOMComponentsStock(bom.components);
  }

  // 1. Direct Supabase Upsert Native Table & Cloud Sync Store
  try {
    if (typeof directSupabaseUpsertNativeRow === 'function') {
      await directSupabaseUpsertNativeRow('bom', bom);
    }
    if (typeof directSupabaseSyncResource === 'function') {
      await directSupabaseSyncResource('bom', state.bom);
    }
  } catch (err) {
    console.warn('Direct Supabase status update error:', err);
  }

  // 2. Server API sync
  try {
    const res = await fetch(`/api/bom/${bom.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bom)
    });

    if (res.ok) {
      if (bom.status === 'Accepted') {
        showToast(`✅ Status BOM (${bom.productName}) berhasil disetujui ("Accepted") & HPP disinkronkan ke Keuangan Project!`, 'success');
      } else if (bom.status === 'Ditolak') {
        showToast(`⚠️ Status BOM ${bom.id} ditolak. Stok barang telah dikembalikan ke Inventory.`, 'warning');
      } else {
        showToast(`ℹ️ Status BOM (${bom.productName}) diatur ke "Pengajuan".`, 'info');
      }
      await fetchResource('bom');
      await fetchResource('purchasing');
      await fetchResource('projects');
      renderBOMPendingOrders();
      renderBOMTable();
      renderOrdersTable();
      if (typeof renderPurchasingTable === 'function') renderPurchasingTable();
      if (typeof renderPurchasingProcessTable === 'function') renderPurchasingProcessTable();
      if (typeof renderPurchasingItemsTable === 'function') renderPurchasingItemsTable();
      updateSidebarBadges();
    } else {
      showToast('Gagal memperbarui status Master BOM', 'error');
      renderBOMPendingOrders();
      renderBOMMasterListTable();
    }
  } catch (err) {
    console.error('Error changing BOM status:', err);
    showToast('Terjadi kesalahan jaringan saat memperbarui status BOM', 'error');
    renderBOMPendingOrders();
    renderBOMMasterListTable();
  }
}

function renderBOMPendingOrders() {
  const tableBody = document.getElementById('table-bom-orders-body');
  const container = document.getElementById('bom-pending-orders-list');
  const countBadge = document.getElementById('bom-pending-orders-count');

  (state.bom || []).forEach(b => {
    if (typeof ensureBOMProjectData === 'function') ensureBOMProjectData(b);
  });

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const userRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : 'Administrator';

  let orders = (state.orders || []).filter(o => !isServiceOrder(o));
  if (userRole === 'Member') {
    orders = orders.filter(o => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(o.id, activeUser) : true);
  }

  let unlinkedItems = [];
  orders.forEach(order => {
    const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);
    const isPOAndAccepted = hasPO && (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status));
    const project = (state.projects || []).find(p => p.orderId === order.id || p.id === order.id);
    const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');

    (order.items || []).forEach(item => {
      const itemNameClean = (item.itemName || '').toLowerCase().trim();

      // Cari semua BOM yang terkait dengan order/item ini (baik Ditolak, Pengajuan, maupun Accepted)
      const bomsForOrder = (state.bom || []).filter(b => 
        b.orderId === order.id || 
        (project && b.projectId === project.id) ||
        (b.projectName && project?.projectName && b.projectName.toLowerCase().trim() === project.projectName.toLowerCase().trim()) ||
        (b.productName && (b.productName || '').toLowerCase().trim() === itemNameClean)
      );

      if (bomsForOrder.length > 0) {
        // Cek apakah sudah terdapat formulasi BOM aktif (Pengajuan atau Accepted) untuk order/item ini
        const hasActiveBOM = bomsForOrder.some(b => b.status === 'Pengajuan' || b.status === 'Accepted');

        // Tampilkan setiap pengajuan BOM sebagai baris tersendiri di halaman BOM
        bomsForOrder.forEach(bom => {
          unlinkedItems.push({
            orderId: order.id,
            customerName: order.customerName,
            orderDate: order.orderDate,
            dueDate: order.dueDate,
            itemName: bom.productName || item.itemName,
            sku: bom.productCode || item.sku,
            qty: item.qty,
            unit: item.unit || 'Unit',
            relatedBOM: bom,
            bomId: bom.id,
            bomStatus: bom.status || 'Pengajuan',
            hasActiveBOM: hasActiveBOM,
            isAlreadyBOM: true,
            isPOAndAccepted,
            hasProjectLead,
            projectLead: project?.projectLead || ''
          });
        });
      } else {
        // Belum ada BOM yang diajukan untuk item order ini
        unlinkedItems.push({
          orderId: order.id,
          customerName: order.customerName,
          orderDate: order.orderDate,
          dueDate: order.dueDate,
          itemName: item.itemName,
          sku: item.sku,
          qty: item.qty,
          unit: item.unit || 'Unit',
          relatedBOM: null,
          bomId: null,
          bomStatus: null,
          hasActiveBOM: false,
          isAlreadyBOM: false,
          isPOAndAccepted,
          hasProjectLead,
          projectLead: project?.projectLead || ''
        });
      }
    });
  });

  if (countBadge) countBadge.textContent = `${unlinkedItems.length} Pengajuan BOM`;

  // 1. Render in Table Body if present
  if (tableBody) {
    if (unlinkedItems.length === 0) {
      if (userRole === 'Member') {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: 36px;"><p style="font-size: 13.5px; font-weight: 600; color: #475569; margin-bottom: 4px;">Belum Ada Order yang Ditugaskan</p><p style="font-size: 12px; color: #94a3b8; margin: 0;">Anda belum terdaftar sebagai Project Lead atau anggota tim pada order/project manapun.</p></td></tr>';
      } else {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: 24px;">Tidak ada order penjualan yang menunggu formulasi BOM.</td></tr>';
      }
    } else {
      tableBody.innerHTML = unlinkedItems.map(item => {
        let statusBadgeHtml = '';
        let actionBtnHtml = '';
        let rowOnClick = '';

        if (!item.isPOAndAccepted) {
          statusBadgeHtml = '<span class="badge badge-secondary" style="font-size: 10px;">⚠️ Menunggu PO/Accepted</span>';
          actionBtnHtml = `<button class="btn btn-sm btn-outline" style="font-size: 11px; opacity: 0.5; cursor: not-allowed;" onclick="event.stopPropagation(); promptPenugasanDisabled('${item.orderId}')" title="Wajib upload PO dan status Accepted"><i data-lucide="lock" style="width: 12px; height: 12px;"></i> Terkunci</button>`;
          rowOnClick = `promptPenugasanDisabled('${item.orderId}')`;
        } else if (!item.hasProjectLead) {
          statusBadgeHtml = '<span class="badge badge-amber" style="font-size: 10px;"><i data-lucide="user-x" style="width: 11px; height: 11px;"></i> Belum Ada Leader</span>';
          actionBtnHtml = `<button class="btn btn-sm btn-outline" style="font-size: 11px; color: #4f46e5; border-color: #c7d2fe;" onclick="event.stopPropagation(); openTeamAssignmentPage('${item.orderId}')" title="Tentukan Project Leader di Penugasan Tim terlebih dahulu"><i data-lucide="users" style="width: 12px; height: 12px;"></i> Penugasan Lead</button>`;
          rowOnClick = `openTeamAssignmentPage('${item.orderId}')`;
        } else if (item.isAlreadyBOM && item.relatedBOM) {
          const currentStatus = item.relatedBOM.status || 'Pengajuan';
          const isAccepted = currentStatus === 'Accepted';
          const isDitolak = currentStatus === 'Ditolak';

          const statusColorStyle = isAccepted
            ? 'border: 1.5px solid #10b981; color: #047857; background: #ecfdf5;'
            : (isDitolak
                ? 'border: 1.5px solid #ef4444; color: #b91c1c; background: #fef2f2;'
                : 'border: 1.5px solid #f59e0b; color: #b45309; background: #fffbeb;');

          const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
          const userRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || 'Member');
          const canApproveBOM = typeof hasRolePermission === 'function'
            ? hasRolePermission('canApproveBOM')
            : ['Administrator', 'Wakil Direktur I', 'Ketua UBM', 'Keuangan'].includes(userRole);

          statusBadgeHtml = canApproveBOM ? `
            <select class="form-control form-control-sm" style="font-size: 11px; padding: 3px 8px; font-weight: 700; border-radius: 6px; cursor: pointer; width: auto; display: inline-block; ${statusColorStyle}" onclick="event.stopPropagation()" onchange="event.stopPropagation(); changeOrderBOMStatus('${item.orderId}', '${item.relatedBOM.id}', this.value)">
              <option value="Pengajuan" ${currentStatus === 'Pengajuan' ? 'selected' : ''}>🟡 Pengajuan</option>
              <option value="Accepted" ${isAccepted ? 'selected' : ''}>🟢 Accepted (Disetujui)</option>
              <option value="Ditolak" ${isDitolak ? 'selected' : ''}>🔴 Ditolak</option>
            </select>
          ` : `
            <span class="badge" style="font-size: 11px; padding: 4px 8px; font-weight: 700; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; ${statusColorStyle}">
              ${isAccepted ? '🟢 Accepted (Disetujui)' : (isDitolak ? '🔴 Ditolak' : '🟡 Pengajuan')}
            </span>
          `;

          actionBtnHtml = `
            <div style="display: inline-flex; gap: 4px;">
              <button class="btn btn-sm btn-outline" style="font-size: 11.5px; padding: 4px 10px; color: #059669; border-color: #a7f3d0;" onclick="event.stopPropagation(); viewBOMDetail('${item.relatedBOM.id}')" title="Lihat Master BOM"><i data-lucide="eye"></i> Lihat</button>
              ${!isAccepted ? `<button class="btn btn-sm btn-outline" style="font-size: 11.5px; padding: 4px 8px; color: #4f46e5; border-color: #c7d2fe;" onclick="event.stopPropagation(); editBOM('${item.relatedBOM.id}')" title="Edit Formula BOM"><i data-lucide="edit-2"></i> Edit</button>` : ''}
              ${isDitolak ? `<button class="btn btn-sm btn-primary" style="font-size: 11.5px; padding: 4px 10px; background: #dc2626; border-color: #dc2626;" onclick="event.stopPropagation(); reapplyBOMFromRejected('${item.orderId}', '${item.relatedBOM.id}')" title="BOM Ditolak: Buat Pengajuan Ulang"><i data-lucide="plus-circle"></i> Ajukan Ulang</button>` : ''}
            </div>
          `;
          rowOnClick = `viewBOMDetail('${item.relatedBOM.id}')`;
        } else {
          statusBadgeHtml = '<span class="badge badge-purple" style="font-size: 10px;"><i data-lucide="boxes" style="width: 11px; height: 11px;"></i> Siap Input BOM</span>';
          const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
          const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(item.orderId, activeUser) : true;
          if (isLead) {
            actionBtnHtml = `<button class="btn btn-sm btn-primary" style="font-size: 11.5px; padding: 4px 12px; background: #2563eb;" onclick="event.stopPropagation(); createBOMFromOrder('${item.orderId}')"><i data-lucide="boxes"></i> Input BOM Order</button>`;
            rowOnClick = `createBOMFromOrder('${item.orderId}')`;
          } else {
            actionBtnHtml = `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 10.5px; border: 1px solid #cbd5e1;">Wewenang Lead</span>`;
            rowOnClick = `showToast('⚠️ Hanya akun yang ditugaskan sebagai Lead Project atau Administrator yang dapat mengisi BOM.', 'warning')`;
          }
        }

        const bomIdSnippet = item.relatedBOM ? `<span class="mono-id font-xs text-muted" style="font-size: 10px; display: block; margin-top: 2px;">BOM ID: ${escapeHtml(item.relatedBOM.id)}</span>` : '';

        return `
          <tr style="cursor: pointer;" onclick="${rowOnClick}" title="Klik baris untuk melihat / memproses formula BOM Order ${item.orderId}">
            <td class="mono-id font-bold text-primary">${item.orderId}</td>
            <td><div class="font-bold text-main">${item.customerName}</div></td>
            <td>
              <div class="font-bold">${item.itemName}</div>
              <div class="text-muted font-sm">${item.sku ? `SKU: ${item.sku}` : ''}</div>
              ${bomIdSnippet}
            </td>
            <td><span class="badge badge-secondary font-bold">${item.qty} ${item.unit}</span></td>
            <td>${item.dueDate || '-'}</td>
            <td style="text-align: center;">${statusBadgeHtml}</td>
            <td class="text-right">
              ${actionBtnHtml}
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 2. Render in Card Container if present
  if (container) {
    if (unlinkedItems.length === 0) {
      if (userRole === 'Member') {
        container.innerHTML = '<div class="text-muted p-4 text-center font-sm"><p style="font-weight: 600; color: #475569; margin-bottom: 2px;">Belum Ada Order yang Ditugaskan</p><p style="color: #94a3b8; font-size: 11.5px; margin: 0;">Anda belum terdaftar sebagai Project Lead atau anggota tim pada order/project manapun.</p></div>';
      } else {
        container.innerHTML = '<div class="text-muted p-3 text-center font-sm">Tidak ada order penjualan yang menunggu pengisian BOM.</div>';
      }
    } else {
      container.innerHTML = unlinkedItems.map(item => {
        let actionBtnHtml = '';
        let statusBadgeHtml = '';
        let cardOnClick = '';

        if (!item.isPOAndAccepted) {
          actionBtnHtml = `<button class="btn btn-sm btn-outline" style="font-size: 11px; opacity: 0.5; cursor: not-allowed;" onclick="event.stopPropagation(); promptPenugasanDisabled('${item.orderId}')" title="Wajib upload PO dan status Accepted"><i data-lucide="lock" style="width: 12px; height: 12px;"></i> PO & Accepted</button>`;
          cardOnClick = `promptPenugasanDisabled('${item.orderId}')`;
        } else if (!item.hasProjectLead) {
          actionBtnHtml = `<button class="btn btn-sm btn-outline" style="font-size: 11px; color: #4f46e5; border-color: #c7d2fe;" onclick="event.stopPropagation(); openTeamAssignmentPage('${item.orderId}')" title="Tentukan Project Leader di Penugasan Tim"><i data-lucide="users" style="width: 12px; height: 12px;"></i> Tentukan Leader</button>`;
          cardOnClick = `openTeamAssignmentPage('${item.orderId}')`;
        } else if (item.isAlreadyBOM && item.relatedBOM) {
          const currentStatus = item.relatedBOM.status || 'Pengajuan';
          const isAccepted = currentStatus === 'Accepted';
          const isDitolak = currentStatus === 'Ditolak';

          const statusColorStyle = isAccepted
            ? 'border: 1.5px solid #10b981; color: #047857; background: #ecfdf5;'
            : (isDitolak
                ? 'border: 1.5px solid #ef4444; color: #b91c1c; background: #fef2f2;'
                : 'border: 1.5px solid #f59e0b; color: #b45309; background: #fffbeb;');

          const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
          const userRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || 'Member');
          const canApproveBOM = typeof hasRolePermission === 'function'
            ? hasRolePermission('canApproveBOM')
            : ['Administrator', 'Wakil Direktur I', 'Ketua UBM', 'Keuangan'].includes(userRole);

          statusBadgeHtml = canApproveBOM ? `
            <select class="form-control form-control-sm" style="font-size: 10.5px; padding: 2px 6px; font-weight: 700; border-radius: 4px; display: inline-block; width: auto; margin-left: 6px; ${statusColorStyle}" onclick="event.stopPropagation()" onchange="event.stopPropagation(); changeOrderBOMStatus('${item.orderId}', '${item.relatedBOM.id}', this.value)">
              <option value="Pengajuan" ${currentStatus === 'Pengajuan' ? 'selected' : ''}>🟡 Pengajuan</option>
              <option value="Accepted" ${isAccepted ? 'selected' : ''}>🟢 Accepted</option>
              <option value="Ditolak" ${isDitolak ? 'selected' : ''}>🔴 Tolak</option>
            </select>
          ` : `
            <span class="badge" style="font-size: 10.5px; padding: 3px 6px; font-weight: 700; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; ${statusColorStyle}">
              ${isAccepted ? '🟢 Accepted' : (isDitolak ? '🔴 Tolak' : '🟡 Pengajuan')}
            </span>
          `;

          actionBtnHtml = `
            <div style="display: inline-flex; gap: 4px;">
              <button class="btn btn-sm btn-outline" style="color: #059669; border-color: #a7f3d0;" onclick="event.stopPropagation(); viewBOMDetail('${item.relatedBOM.id}')"><i data-lucide="eye"></i> Lihat BOM</button>
              ${!isAccepted ? `<button class="btn btn-sm btn-outline" style="color: #4f46e5; border-color: #c7d2fe;" onclick="event.stopPropagation(); editBOM('${item.relatedBOM.id}')"><i data-lucide="edit-2"></i></button>` : ''}
              ${isDitolak ? `<button class="btn btn-sm btn-primary" style="background: #dc2626; border-color: #dc2626;" onclick="event.stopPropagation(); reapplyBOMFromRejected('${item.orderId}', '${item.relatedBOM.id}')"><i data-lucide="plus-circle"></i> Ajukan Ulang</button>` : ''}
            </div>
          `;
          cardOnClick = `viewBOMDetail('${item.relatedBOM.id}')`;
        } else {
          const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
          const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(item.orderId, activeUser) : true;
          if (isLead) {
            actionBtnHtml = `<button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); createBOMFromOrder('${item.orderId}')"><i data-lucide="boxes"></i> Input BOM Order</button>`;
            cardOnClick = `createBOMFromOrder('${item.orderId}')`;
          } else {
            actionBtnHtml = `<span class="badge" style="background: #f1f5f9; color: #64748b; font-size: 10.5px; border: 1px solid #cbd5e1;">Wewenang Lead</span>`;
            cardOnClick = `showToast('⚠️ Hanya akun yang ditugaskan sebagai Lead Project atau Administrator yang dapat mengisi BOM.', 'warning')`;
          }
        }

        return `
          <div style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #ffffff; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px;" onclick="${cardOnClick}">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="mono-id" style="font-size: 11px;">${item.orderId}</span>
              <div>
                <div class="font-bold text-main" style="font-size: 13px">${item.itemName} ${statusBadgeHtml}</div>
                <div class="text-muted" style="font-size: 11px;">Pelanggan: <strong>${item.customerName}</strong> &bull; Qty: ${item.qty} ${item.unit} ${item.relatedBOM ? `&bull; BOM: <strong>${item.relatedBOM.id}</strong>` : ''} ${item.hasProjectLead ? `&bull; Lead: <strong>${item.projectLead}</strong>` : '<span style="color:#e11d48;">&bull; (Belum ada Lead)</span>'}</div>
              </div>
            </div>
            <div>
              ${actionBtnHtml}
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function reapplyBOMFromRejected(orderId, bomId) {
  const rejectedBOM = (state.bom || []).find(b => b.id === bomId);
  const order = (state.orders || []).find(o => o.id === orderId);
  if (!rejectedBOM) return;

  const itemName = rejectedBOM.productName || (order?.items?.[0]?.itemName) || `Produk Order ${orderId}`;
  const itemNameClean = itemName.toLowerCase().trim();
  const sku = rejectedBOM.productCode || (order?.items?.[0]?.sku) || '';

  // Validasi: Cek apakah sudah ada formulasi BOM aktif (Pengajuan atau Accepted) untuk order / item ini
  const activeBOM = (state.bom || []).find(b => 
    (b.orderId === orderId || (b.productName && b.productName.toLowerCase().trim() === itemNameClean)) &&
    (b.status === 'Pengajuan' || b.status === 'Accepted')
  );

  if (activeBOM) {
    showToast(`⚠️ Tidak dapat mengajukan ulang karena sudah terdapat formulasi BOM aktif (${activeBOM.id} - Status: ${activeBOM.status}) untuk order ini!`, 'warning');
    return;
  }

  // Buka formulir BOM dengan draf dari rejectedBOM, tapi isReadOnly = false dan isReapply = true
  openBOMPage(rejectedBOM, orderId, itemName, sku, false, true);
}

function createBOMFromOrder(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);
  const isPOAndAccepted = hasPO && (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status));
  if (!isPOAndAccepted) {
    if (typeof promptPenugasanDisabled === 'function') {
      promptPenugasanDisabled(orderId);
    } else {
      showToast('⚠️ Wajib upload PO Pelanggan dan status Accepted terlebih dahulu!', 'warning');
    }
    return;
  }

  const project = (state.projects || []).find(p => p.orderId === orderId);
  const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');
  if (!hasProjectLead) {
    showToast('⚠️ Tentukan dan simpan Project Leader pada menu Penugasan Tim terlebih dahulu sebelum mengisi BOM!', 'warning');
    if (typeof openTeamAssignmentPage === 'function') {
      openTeamAssignmentPage(orderId);
    }
    return;
  }
  
  const firstItem = (order.items && order.items.length > 0) ? order.items[0] : null;
  const itemName = firstItem ? firstItem.itemName : `Produk Order ${order.id}`;
  const sku = firstItem ? (firstItem.sku || '') : '';
  
  // Cari semua BOM untuk order ini
  const existingBOMs = (state.bom || []).filter(b => 
    b.orderId === orderId || 
    (project && b.projectId === project.id) ||
    (order.items && order.items.some(it => b.productName && it.itemName && b.productName.toLowerCase().trim() === it.itemName.toLowerCase().trim()))
  );

  state.bomReturnView = 'orders';

  const acceptedBOM = existingBOMs.find(b => b.status === 'Accepted');
  const pendingBOM = existingBOMs.find(b => b.status === 'Pengajuan');
  const rejectedBOM = existingBOMs.find(b => b.status === 'Ditolak');

  // Validasi Wewenang: Hanya Lead Project, Pengguna dengan Wewenang BOM, atau Administrator
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const canManage = typeof hasRolePermission === 'function' ? hasRolePermission('canManageBOM') : true;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(orderId, activeUser) : true;

  if (activeUser && !canManage && !isLead) {
    const existingBOM = acceptedBOM || pendingBOM || existingBOMs[0];
    if (existingBOM) {
      showToast('Mode Lihat: Hanya Lead Project atau Administrator yang dapat mengisi/mengubah formula BOM. Anda membuka dalam mode pratinjau.', 'info');
      openBOMPage(existingBOM, order.id, itemName, sku, true);
      return;
    } else {
      showToast(`⚠️ Hanya akun yang ditugaskan sebagai Lead Project (${escapeHtml(project?.projectLead || 'Lead')}) atau Administrator yang dapat mengisi BOM baru.`, 'warning');
      return;
    }
  }

  if (acceptedBOM) {
    // BOM sudah Accepted: Buka BOM dalam mode TERKUNCI (Read-Only)
    openBOMPage(acceptedBOM, order.id, itemName, sku, true);
  } else if (pendingBOM) {
    // BOM masih Pengajuan: Buka mode EDIT formulasi BOM
    openBOMPage(pendingBOM, order.id, itemName, sku, false);
  } else if (rejectedBOM) {
    // BOM Ditolak: Buka formulir pengajuan ulang formula baru
    reapplyBOMFromRejected(order.id, rejectedBOM.id);
  } else {
    // BOM belum pernah dibuat: Buka form pembuatan BOM baru
    openBOMPage(null, order.id, itemName, sku, false);
  }
}

function getAvailablePRComponents() {
  const list = [];
  
  // Ambil data barang dari Database Master Barang yang SUDAH DISETUJUI & STATUS 'Sesuai'
  // Dan hitung sisa stok tersedia riil (setelah pemotongan BOM lain dan pengembalian sisa project)
  const masterItems = typeof getMasterItemsList === 'function' ? getMasterItemsList() : [];
  const masterMap = new Map();
  masterItems.forEach(m => masterMap.set((m.itemName || '').toLowerCase().trim(), m));

  (state.purchasing || []).forEach(pr => {
    const isStock = pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved';
    if (!isStock) return;

    (pr.items || []).forEach((item, itemIdx) => {
      if (item.itemStatus !== 'Sesuai') return;
      const itemNameClean = (item.itemName || '').trim();
      const mMatch = masterMap.get(itemNameClean.toLowerCase());
      
      // Gunakan stok tersedia dari Master Inventory jika ada
      const availableQty = mMatch ? mMatch.qty : (parseFloat(item.qty) || 0);
      const unitCost = parseFloat(item.purchasePrice !== undefined ? item.purchasePrice : (item.actualPrice !== undefined ? item.actualPrice : (item.estimatedPrice || item.unitPrice || 0))) || 0;
      
      list.push({
        prId: pr.id,
        itemIndex: itemIdx,
        department: pr.department || 'Umum',
        requestor: pr.requestor || '-',
        status: 'Disetujui',
        itemName: item.itemName,
        specs: item.specs || '',
        qty: availableQty,
        initialQty: parseFloat(item.qty) || 0,
        unit: item.unit || 'Pcs',
        unitCost: unitCost,
        totalCost: parseFloat(item.total) || (availableQty * unitCost),
        source: `PR: ${pr.id} (${pr.department || 'Umum'})`
      });
    });
  });

  return list;
}

// ---------------- PR CHECKLIST PICKER (INVENTORY MODAL) ----------------
function openPRPickerModal() {
  const filterSelect = document.getElementById('pr-picker-filter');
  if (filterSelect) {
    const prSet = new Set();
    (state.purchasing || []).forEach(p => {
      if (p.status === 'Disetujui' || p.status === 'Stock' || p.status === 'Approved') {
        const hasSesuai = (p.items || []).some(it => it.itemStatus === 'Sesuai');
        if (hasSesuai) {
          prSet.add(p);
        }
      }
    });
    
    let opts = '<option value="ALL">Semua Barang Master Inventory (Status Sesuai)</option>';
    prSet.forEach(p => {
      opts += `<option value="${p.id}">[${p.id}] ${escapeAttr(p.requestor || '-')} - ${escapeAttr(p.department || 'Umum')}</option>`;
    });
    filterSelect.innerHTML = opts;
  }

  const searchInput = document.getElementById('pr-picker-search');
  if (searchInput) searchInput.value = '';

  const selectAll = document.getElementById('pr-picker-select-all');
  if (selectAll) selectAll.checked = false;

  renderPRPickerItems();
  openModal('pr-picker-modal');
  if (window.lucide) lucide.createIcons();
}

function getExistingBOMComponentsMap() {
  const map = new Map();
  const blocks = document.querySelectorAll('#page-bom-components-list .bom-item-block');
  blocks.forEach(b => {
    const prId = b.dataset.prId || '';
    const itemIndex = b.dataset.itemIndex;
    const name = b.querySelector('.bom-comp-name')?.value?.trim().toLowerCase() || b.dataset.prItemName?.trim().toLowerCase() || '';
    const qty = parseFloat(b.querySelector('.bom-comp-qty')?.value) || parseFloat(b.dataset.usedQty) || 0;
    
    if (name) {
      if (prId && itemIndex !== undefined && itemIndex !== '') {
        map.set(`${prId}:::${itemIndex}`, { name, qty, prId, itemIndex });
      }
      if (prId) {
        map.set(`${prId}:::${name}`, { name, qty, prId });
      }
      if (!map.has(name)) {
        map.set(name, { name, qty, prId });
      }
    }
  });
  return map;
}

function renderPRPickerItems() {
  const tbody = document.getElementById('pr-picker-table-body');
  if (!tbody) return;

  const searchQuery = (document.getElementById('pr-picker-search')?.value || '').toLowerCase();
  const filterVal = document.getElementById('pr-picker-filter')?.value || 'ALL';

  let items = getAvailablePRComponents();

  if (filterVal !== 'ALL') {
    items = items.filter(i => i.prId === filterVal);
  }

  if (searchQuery) {
    items = items.filter(i => 
      i.itemName.toLowerCase().includes(searchQuery) ||
      (i.specs && i.specs.toLowerCase().includes(searchQuery)) ||
      i.source.toLowerCase().includes(searchQuery) ||
      i.unit.toLowerCase().includes(searchQuery)
    );
  }

  currentPRPickerItems = items;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted" style="padding: 28px 16px;">
          <i data-lucide="package-search" style="width: 32px; height: 32px; color: #94a3b8; margin: 0 auto 8px auto; display: block;"></i>
          <strong>Tidak ada stok barang dari Request Pengadaan (PR) berstatus Stock.</strong>
          <p style="font-size: 11.5px; color: #64748b; margin: 4px 0 12px 0;">Pastikan dokumen Request Pengadaan Barang (PR) telah diubah statusnya menjadi <span class="badge badge-success" style="font-size: 10.5px;">Stock</span> pada tab Daftar Dokumen PR.</p>
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button type="button" class="btn btn-sm btn-primary" onclick="closeModal('pr-picker-modal'); redirectToPurchasingPR();">
              <i data-lucide="plus"></i> Ajukan PR Baru Sekarang
            </button>
            <button type="button" class="btn btn-sm btn-outline" onclick="closeModal('pr-picker-modal'); navigateTo('purchasing'); switchPurchasingTab('items');">
              <i data-lucide="database"></i> Buka Database Master Barang
            </button>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    updatePRPickerCount();
    return;
  }

  const existingMap = getExistingBOMComponentsMap();

  tbody.innerHTML = items.map((item, idx) => {
    const isOutOfStock = item.qty <= 0;
    const existingKey1 = `${item.prId}:::${item.itemIndex}`;
    const existingKey2 = `${item.prId}:::${item.itemName.toLowerCase()}`;
    const existingKey3 = item.itemName.toLowerCase();
    const existingComp = existingMap.get(existingKey1) || existingMap.get(existingKey2) || existingMap.get(existingKey3);

    const isSelected = !isOutOfStock && !!existingComp;
    const initialQty = isSelected ? (existingComp.qty || 1) : Math.min(1, item.qty);
    const initialRemStock = Math.max(0, item.qty - (isSelected ? initialQty : 0));

    const badgeClass = item.status === 'Approved' ? 'badge-success' :
                       item.status === 'In Review' ? 'badge-purple' :
                       item.status === 'Received' ? 'badge-info' : 'badge-secondary';

    return `
      <tr id="pr-row-${idx}" style="${isOutOfStock ? 'opacity: 0.55; background: #fafafa;' : (isSelected ? 'background: #eff6ff;' : '')}">
        <td style="text-align: center;">
          <input type="checkbox" class="pr-item-checkbox" id="pr-chk-${idx}" data-idx="${idx}" onchange="onPRCheckboxChange(${idx})" ${isOutOfStock ? 'disabled' : ''} ${isSelected ? 'checked' : ''}>
        </td>
        <td>
          <div class="font-bold text-main" style="font-size: 13px;">${item.itemName}</div>
          ${item.specs ? `<div class="text-muted font-sm" style="font-size: 11px;">${escapeAttr(item.specs)}</div>` : ''}
          <div class="text-muted font-sm" style="font-size: 10.5px;">Satuan: <strong>${item.unit}</strong></div>
        </td>
        <td style="text-align: center;">
          <span class="badge ${isOutOfStock ? 'badge-secondary' : 'badge-purple'}" style="font-weight: 700; font-size: 11.5px;">
            ${item.qty} ${item.unit}
          </span>
        </td>
        <td style="text-align: center;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <input type="number" class="form-control form-control-sm pr-use-qty" id="pr-use-qty-${idx}" min="0.01" max="${item.qty}" step="any" value="${isOutOfStock ? 0 : initialQty}" style="width: 75px; height: 30px; font-weight: 700; text-align: right;" oninput="updatePRRowRemaining(${idx})" ${isSelected ? '' : 'disabled'}>
            <span class="text-muted font-sm" style="font-size: 11px;">${item.unit}</span>
          </div>
        </td>
        <td style="text-align: center;">
          <span id="pr-rem-stock-${idx}" class="badge ${isOutOfStock || initialRemStock === 0 ? 'badge-secondary' : 'badge-success'}" style="font-size: 11px; font-weight: 700;">
            ${initialRemStock} ${item.unit}
          </span>
        </td>
        <td class="font-bold text-emerald">${formatRupiah(item.unitCost)}</td>
        <td>
          <div class="font-bold font-sm text-primary">${item.prId}</div>
          <div class="text-muted" style="font-size: 11px;">${item.department}</div>
        </td>
        <td><span class="badge ${badgeClass}">${item.status}</span></td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
  updatePRPickerCount();
}

function onPRCheckboxChange(idx) {
  const chk = document.getElementById(`pr-chk-${idx}`);
  const qtyInput = document.getElementById(`pr-use-qty-${idx}`);
  const row = document.getElementById(`pr-row-${idx}`);
  
  if (chk && qtyInput) {
    qtyInput.disabled = !chk.checked;
    if (chk.checked) {
      if (row) row.style.background = '#eff6ff';
    } else {
      if (row) row.style.background = '';
    }
  }
  updatePRRowRemaining(idx);
  updatePRPickerCount();
}

function updatePRRowRemaining(idx) {
  const item = currentPRPickerItems[idx];
  if (!item) return;

  const chk = document.getElementById(`pr-chk-${idx}`);
  const qtyInput = document.getElementById(`pr-use-qty-${idx}`);
  const remBadge = document.getElementById(`pr-rem-stock-${idx}`);

  let usedQty = 0;
  if (chk && chk.checked && qtyInput) {
    usedQty = parseFloat(qtyInput.value) || 0;
    if (usedQty > item.qty) {
      usedQty = item.qty;
      qtyInput.value = item.qty;
      showToast(`Maksimal stok yang tersedia adalah ${item.qty} ${item.unit}`, 'warning');
    } else if (usedQty < 0) {
      usedQty = 0;
      qtyInput.value = 0;
    }
  }

  const remaining = Math.max(0, item.qty - usedQty);
  if (remBadge) {
    const formattedRem = remaining % 1 === 0 ? remaining : remaining.toFixed(2);
    remBadge.textContent = `${formattedRem} ${item.unit}`;
    remBadge.className = `badge ${remaining === 0 ? 'badge-secondary' : 'badge-success'}`;
  }
}

function toggleSelectAllPRPicker(masterCheckbox) {
  const checkboxes = document.querySelectorAll('#pr-picker-table-body .pr-item-checkbox:not(:disabled)');
  checkboxes.forEach(cb => {
    cb.checked = masterCheckbox.checked;
    const idx = parseInt(cb.dataset.idx, 10);
    onPRCheckboxChange(idx);
  });
  updatePRPickerCount();
}

function updatePRPickerCount() {
  const checked = document.querySelectorAll('#pr-picker-table-body .pr-item-checkbox:checked');
  const countEl = document.getElementById('pr-picker-selected-count');
  const btnConfirm = document.getElementById('btn-confirm-pr-picker');
  
  if (countEl) {
    countEl.textContent = `${checked.length} barang dipilih`;
  }
  if (btnConfirm) {
    btnConfirm.disabled = checked.length === 0;
    btnConfirm.innerHTML = `<i data-lucide="check"></i> Gunakan Barang Terpilih (${checked.length})`;
    if (window.lucide) lucide.createIcons();
  }
}

function confirmPRPickerSelection() {
  const checkedBoxes = document.querySelectorAll('#pr-picker-table-body .pr-item-checkbox:checked');
  if (checkedBoxes.length === 0) {
    showToast('Harap pilih minimal satu barang dari Inventory', 'warning');
    return;
  }

  const container = document.getElementById('page-bom-components-list');
  if (!container) return;

  // Kosongkan daftar komponen sebelumnya agar tersinkronisasi 1:1 dengan pilihan di modal
  container.innerHTML = '';

  let addedCount = 0;

  for (const cb of checkedBoxes) {
    const idx = parseInt(cb.dataset.idx, 10);
    const item = currentPRPickerItems[idx];
    if (!item) continue;

    const qtyInput = document.getElementById(`pr-use-qty-${idx}`);
    const usedQty = Math.max(0.01, parseFloat(qtyInput?.value) || 1);

    addBOMPageComponentRow({
      prId: item.prId,
      itemIndex: item.itemIndex,
      componentName: item.itemName,
      specs: item.specs || '',
      qty: usedQty,
      unit: item.unit || 'Pcs',
      unitCost: item.unitCost || 0
    });
    addedCount++;
  }

  closeModal('pr-picker-modal');
  calculateBOMPageTotals();
  showToast(`✅ ${addedCount} Komponen dari Inventory disinkronkan ke Struktur Komponen BOM!`, 'success');
}

function redirectToPurchasingPR(targetParam = null, targetQty = null, targetUnit = null, targetCost = null) {
  closeModal('form-modal');
  closeModal('pr-picker-modal');

  // Ambil konteks aktif dari formulir BOM (Informasi Produk Jadi)
  const orderId = document.getElementById('page-bom-order-select')?.value || '';
  const productName = document.getElementById('page-bom-name')?.value?.trim() || '';
  const productCode = document.getElementById('page-bom-code')?.value?.trim() || '';
  const order = (state.orders || []).find(o => o.id === orderId);
  const project = (state.projects || []).find(p => p.orderId === orderId);

  // Auto-fill Requestor (Project Lead dari Penugasan Tim atau PIC)
  let requestor = '';
  if (project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign') {
    requestor = project.projectLead;
  } else if (order?.customerName) {
    requestor = `Lead Produksi (${order.customerName})`;
  } else {
    requestor = 'Tim Engineering & Produksi';
  }

  // Auto-fill Departemen
  let department = 'Engineering & Produksi';
  if (project?.department && project.department.trim() !== '') {
    const validDepts = ['Engineering & Produksi', 'Fabrikasi & Las', 'Quality Control (QC)', 'Logistik & Gudang', 'Umum & Operasional'];
    const matchedDept = validDepts.find(d => d.toLowerCase().includes(project.department.toLowerCase()) || project.department.toLowerCase().includes(d.toLowerCase()));
    if (matchedDept) {
      department = matchedDept;
    }
  }

  // Kumpulkan barang yang diajukan ke PR
  const items = [];
  
  if (targetParam && targetParam.nodeType) {
    // 1. Dipanggil dari tombol "Ajukan ke Purchasing" pada baris komponen berstatus Stok Kosong
    const block = targetParam.closest('.bom-item-block');
    if (block) {
      const name = block.querySelector('.bom-comp-name')?.value?.trim();
      const qty = parseFloat(block.querySelector('.bom-comp-qty')?.value) || 1;
      const unit = block.querySelector('.bom-comp-unit')?.value?.trim() || 'Pcs';
      const cost = parseFloat(block.querySelector('.bom-comp-cost')?.value) || 0;
      if (name) {
        items.push({
          itemName: name,
          qty,
          unit,
          estimatedPrice: cost,
          unitPrice: cost
        });
      }
    }
  } else if (typeof targetParam === 'string' && targetParam === 'OUT_OF_STOCK_ITEMS') {
    // 2. Dipanggil dari banner peringatan stok kosong (hanya masukkan komponen yang stoknya 0)
    const outOfStockBlocks = document.querySelectorAll('#page-bom-components-list .bom-item-block[data-out-of-stock="true"], #page-bom-components-list .bom-item-block.item-out-of-stock');
    outOfStockBlocks.forEach(b => {
      const name = b.querySelector('.bom-comp-name')?.value?.trim();
      const qty = parseFloat(b.querySelector('.bom-comp-qty')?.value) || 1;
      const unit = b.querySelector('.bom-comp-unit')?.value?.trim() || 'Pcs';
      const cost = parseFloat(b.querySelector('.bom-comp-cost')?.value) || 0;
      if (name) {
        items.push({
          itemName: name,
          qty,
          unit,
          estimatedPrice: cost,
          unitPrice: cost
        });
      }
    });
  } else if (typeof targetParam === 'string' && targetParam.trim() !== '') {
    // 3. Dipanggil dengan nama item spesifik
    items.push({
      itemName: targetParam.trim(),
      qty: parseFloat(targetQty) || 1,
      unit: targetUnit || 'Pcs',
      estimatedPrice: parseFloat(targetCost) || 0,
      unitPrice: parseFloat(targetCost) || 0
    });
  }
  // Catatan: Jika targetParam === null (tombol Purchasing di card Struktur Komponen), rincian barang sengaja dikosongkan (items = []) sesuai permintaan pengguna.

  // Auto-fill Keperluan / Tujuan Pengadaan (Informasi Produk Jadi & Konteks BOM)
  const productInfoStr = productName ? `${productName}${productCode ? ` [${productCode}]` : ''}` : '';
  let purpose = '';
  if (items.length > 0) {
    let itemNamesSummary = items.map(i => i.itemName).join(', ');
    if (itemNamesSummary.length > 50) itemNamesSummary = itemNamesSummary.substring(0, 47) + '...';
    purpose = `Pengadaan ${items.length} Komponen: ${itemNamesSummary}${productInfoStr ? ` untuk ${productInfoStr}` : ''}${orderId ? ` (Order #${orderId})` : ''}`;
  } else {
    purpose = productInfoStr
      ? `Pengadaan Bahan Baku & Komponen Produksi: ${productInfoStr}${orderId ? ` (Order #${orderId})` : ''}`
      : (orderId ? `Pengadaan Komponen Bahan Baku Order #${orderId}` : 'Pengadaan Bahan Baku & Komponen Produksi BOM');
  }

  const prefilledPR = {
    requestor: '',
    department: '',
    urgency: '',
    status: 'Pengajuan',
    purpose: '',
    requestDate: '',
    requiredDate: '',
    items: items
  };

  navigateTo('purchasing');
  setTimeout(() => {
    openPurchasingModal(prefilledPR);
    if (items.length > 0) {
      showToast(`${items.length} rincian barang material otomatis dimuat ke formulir PR!`, 'info');
    }
  }, 120);
}

// ---------------- FULL-PAGE BOM FORM ----------------
function renderBOMEmptyState(isReadOnly = false) {
  const container = document.getElementById('page-bom-components-list');
  if (!container) return;
  container.innerHTML = `
    <div id="bom-empty-components" style="padding: 24px 16px; text-align: center; border: 2px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; color: var(--text-muted); margin-bottom: 8px;">
      <i data-lucide="boxes" style="width: 28px; height: 28px; color: #94a3b8; margin: 0 auto 8px auto; display: block;"></i>
      <div style="font-weight: 700; font-size: 13px; color: #475569;">Belum Ada Komponen / Bahan Baku</div>
      <div style="font-size: 11.5px; margin-top: 4px; color: #64748b;">
        ${isReadOnly ? 'Tidak ada rincian komponen yang terdaftar pada formula BOM ini.' : 'Klik tombol <strong style="color: #2563eb;">Inventory</strong> di atas untuk memilih bahan baku dari stok barang inventory, atau klik tombol <strong style="color: #2563eb;">Purchasing</strong> untuk mengajukan pengadaan bahan baru jika barang belum ada di inventory.'}
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function navigateBackFromBOM() {
  const target = state.bomReturnView || state.previousMainView || (state.previousView !== 'bom-form' ? state.previousView : null) || 'bom';
  navigateTo(target);
}

let currentActiveBOMPageData = null;

function openBOMPage(bomData = null, defaultOrderId = null, defaultItemName = null, defaultSku = null, isReadOnly = false, isReapply = false) {
  currentActiveBOMPageData = bomData || {
    orderId: defaultOrderId || '',
    productName: defaultItemName || '',
    productCode: defaultSku || '',
    components: []
  };

  // Tentukan view asal pemanggil
  if (state.currentView === 'orders') {
    state.bomReturnView = 'orders';
  } else {
    state.bomReturnView = 'bom';
  }

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const userRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || 'Member');

  // Guard khusus: Pembuatan Master BOM baru dari tab Template BOM (tanpa kaitan order)
  if (!bomData && !defaultOrderId) {
    const canCreateMaster = typeof canUserCreateMasterBOM === 'function' ? canUserCreateMasterBOM(activeUser) : true;
    if (!canCreateMaster) {
      showToast('⚠️ Member tidak memiliki akses untuk membuat Master BOM. Master BOM hanya bisa dibuat oleh Administrator, Lead Project, dan Ketua UBM.', 'warning');
      return;
    }
  }

  const boundOrder = bomData?.orderId || defaultOrderId;
  const canManage = typeof hasRolePermission === 'function' ? hasRolePermission('canManageBOM') : true;
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(boundOrder, activeUser) : true;
  if (activeUser && !canManage && !isLead) {
    isReadOnly = true;
  }
  if (defaultOrderId && !bomData) {
    const order = (state.orders || []).find(o => o.id === defaultOrderId);
    if (order) {
      const hasPO = Boolean(order.poDocument?.url || order.poFileUrl || order.poDocument?.name || order.poFileName);
      const isPOAndAccepted = hasPO && (order.status === 'Accepted' || ['Confirmed', 'In Production', 'Delivered'].includes(order.status));
      if (!isPOAndAccepted) {
        if (typeof promptPenugasanDisabled === 'function') {
          promptPenugasanDisabled(defaultOrderId);
        } else {
          showToast('⚠️ Wajib upload PO Pelanggan dan status Accepted terlebih dahulu!', 'warning');
        }
        return;
      }

      const project = (state.projects || []).find(p => p.orderId === defaultOrderId);
      const hasProjectLead = Boolean(project?.projectLead && project.projectLead.trim() !== '' && project.projectLead !== 'Belum diassign');
      const isAdminOrKetua = activeUser && (activeUser.role === 'Administrator' || activeUser.role === 'Ketua UBM' || activeUser.role === 'Wakil Direktur I' || (typeof getNormalizedRole === 'function' && ['Administrator', 'Ketua UBM', 'Wakil Direktur I'].includes(getNormalizedRole(activeUser))));
      if (!hasProjectLead && !isAdminOrKetua) {
        showToast(`⚠️ Harap tentukan dan simpan Project Leader terlebih dahulu pada menu Penugasan Tim untuk Order ${defaultOrderId}!`, 'warning');
        if (typeof openTeamAssignmentPage === 'function') {
          openTeamAssignmentPage(defaultOrderId);
        }
        return;
      }
    }
  }

  // Jika isReapply = true, ini adalah pengajuan BARU (bukan edit record lama)
  const isEdit = !isReapply && !!bomData;

  const formTitle = document.getElementById('bom-page-form-title');
  if (formTitle) {
    if (isReadOnly) {
      formTitle.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <i data-lucide="shield-check" style="color: #059669;"></i>
          Formula Master BOM: <span class="mono-id">${bomData ? escapeHtml(bomData.id) : ''}</span>
          <span class="badge badge-success" style="font-size: 11px; margin-left: 6px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="lock" style="width: 12px; height: 12px;"></i> Terkunci &amp; Ditetapkan
          </span>
        </span>
      `;
    } else if (isReapply) {
      formTitle.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <i data-lucide="plus-circle" style="color: #2563eb;"></i>
          Pengajuan Ulang Formula BOM Baru
          <span class="badge badge-amber" style="font-size: 11px; margin-left: 6px; padding: 4px 8px;">Revisi dari ${escapeHtml(bomData?.id || '')}</span>
        </span>
      `;
    } else if (isEdit) {
      formTitle.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          <i data-lucide="edit-3" style="color: #2563eb;"></i>
          Edit Master BOM: <span class="mono-id">${escapeHtml(bomData.id)}</span>
        </span>
      `;
    } else {
      formTitle.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 8px;">
          <i data-lucide="boxes" style="color: #2563eb;"></i>
          Buat Master Bill of Materials (BOM) Baru
        </span>
      `;
    }
  }

  const subtitleEl = document.querySelector('#view-bom-form h2 + p');
  if (subtitleEl) {
    subtitleEl.textContent = isReadOnly ?
      'Formula Master BOM untuk project/order ini telah disimpan dan ditetapkan sebagai standar resmi produksi sehingga tidak dapat diubah kembali.' :
      (isReapply ?
        `Perbaiki formulasi bahan baku dan biaya dari draft sebelumnya (${bomData?.id}). Formula baru ini akan dicatat sebagai pengajuan terpisah.` :
        'Formulasi struktur bahan baku, komponen dari PR, biaya tenaga kerja, dan kalkulasi HPP produksi');
  }

  // Handle Banner Read-Only / Reapply / Ditolak
  let bannerEl = document.getElementById('bom-readonly-banner');
  if (isReadOnly) {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'bom-readonly-banner';
      const formEl = document.getElementById('bom-page-form');
      if (formEl && formEl.parentNode) {
        formEl.parentNode.insertBefore(bannerEl, formEl);
      }
    }
    if (bannerEl) {
      bannerEl.style.display = 'block';
      const boundOrderId = bomData?.orderId || defaultOrderId || '';
      bannerEl.innerHTML = `
        <div style="background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%); border: 1px solid #a7f3d0; border-left: 4px solid #10b981; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #d1fae5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
              <i data-lucide="lock"></i>
            </div>
            <div>
              <div style="font-weight: 700; color: #065f46; font-size: 13.5px;">Formula Master BOM Telah Ditetapkan (Terkunci)</div>
              <div style="font-size: 12px; color: #047857; margin-top: 2px;">
                Formula bahan baku dan perhitungan HPP untuk <strong>${escapeHtml(bomData?.productName || defaultItemName || 'Project Ini')}</strong> ${boundOrderId ? `(Order: <strong>${escapeHtml(boundOrderId)}</strong>)` : ''} telah disimpan ke sistem dan menjadi acuan produksi sehingga komponen yang sudah ada tidak dapat diubah kembali. Anda dapat menambahkan komponen yang diperlukan melalui tombol <strong>+ Tambah Komponen</strong> pada Struktur Komponen &amp; Bahan Baku di bawah.
              </div>
            </div>
          </div>
          <span class="badge badge-success" style="font-size: 11.5px; padding: 6px 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="shield-check" style="width: 14px; height: 14px;"></i> Read-Only
          </span>
        </div>
      `;
    }
  } else if (isReapply) {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'bom-readonly-banner';
      const formEl = document.getElementById('bom-page-form');
      if (formEl && formEl.parentNode) {
        formEl.parentNode.insertBefore(bannerEl, formEl);
      }
    }
    if (bannerEl) {
      bannerEl.style.display = 'block';
      const boundOrderId = bomData?.orderId || defaultOrderId || '';
      bannerEl.innerHTML = `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #dbeafe; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
              <i data-lucide="refresh-cw"></i>
            </div>
            <div>
              <div style="font-weight: 700; color: #1e40af; font-size: 13.5px;">Pengajuan Ulang Formula BOM Baru</div>
              <div style="font-size: 12px; color: #1d4ed8; margin-top: 2px;">
                Anda sedang membuat pengajuan formula BOM baru untuk <strong>${escapeHtml(bomData?.productName || defaultItemName || 'Project Ini')}</strong> ${boundOrderId ? `(Order: <strong>${escapeHtml(boundOrderId)}</strong>)` : ''} berdasarkan draf sebelumnya (<strong>${escapeHtml(bomData?.id || '')}</strong>). Pengajuan ini akan disimpan sebagai entri terpisah dan memotong stok inventory saat disimpan.
              </div>
            </div>
          </div>
          <span class="badge badge-info" style="font-size: 11.5px; padding: 6px 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="plus-circle" style="width: 14px; height: 14px;"></i> Pengajuan Baru
          </span>
        </div>
      `;
    }
  } else if (bomData && bomData.status === 'Ditolak') {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'bom-readonly-banner';
      const formEl = document.getElementById('bom-page-form');
      if (formEl && formEl.parentNode) {
        formEl.parentNode.insertBefore(bannerEl, formEl);
      }
    }
    if (bannerEl) {
      bannerEl.style.display = 'block';
      const boundOrderId = bomData?.orderId || defaultOrderId || '';
      bannerEl.innerHTML = `
        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
              <i data-lucide="alert-circle"></i>
            </div>
            <div>
              <div style="font-weight: 700; color: #991b1b; font-size: 13.5px;">Formula BOM Berstatus Ditolak (Terkunci)</div>
              <div style="font-size: 12px; color: #b91c1c; margin-top: 2px;">
                Pengajuan formula BOM <strong>${escapeHtml(bomData?.id || '')}</strong> telah ditolak dan tidak dapat diubah lagi. Gunakan opsi pengajuan ulang untuk membuat formula baru.
              </div>
            </div>
          </div>
          <span class="badge badge-danger" style="font-size: 11.5px; padding: 6px 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="x-circle" style="width: 14px; height: 14px;"></i> Status: Ditolak
          </span>
        </div>
      `;
    }
  } else {
    if (bannerEl) bannerEl.remove();
  }

  const editIdInput = document.getElementById('page-bom-edit-id');
  if (editIdInput) editIdInput.value = (isEdit && !isReapply) ? bomData.id : '';

  const selectedOrderId = bomData?.orderId || defaultOrderId;
  const orderSelect = document.getElementById('page-bom-order-select');
  if (orderSelect) {
    let orderOptions = '<option value="">-- Template Umum / Tanpa Kaitan Order --</option>';
    let ordersList = (state.orders || []).filter(o => !isServiceOrder(o));
    if (userRole === 'Member') {
      ordersList = ordersList.filter(o => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(o.id, activeUser) : true);
    }
    ordersList.forEach(o => {
      (o.items || []).forEach((item, idx) => {
        const isSelected = selectedOrderId === o.id && (isEdit ? (!defaultItemName || defaultItemName === item.itemName) : (selectedOrderId === o.id));
        orderOptions += `<option value="${o.id}::${idx}" ${isSelected ? 'selected' : ''}>[${o.id}] ${o.customerName} - ${item.itemName} (${item.qty} ${item.unit || 'Unit'})</option>`;
      });
    });
    orderSelect.innerHTML = orderOptions;
    if (!isEdit && !defaultOrderId) {
      orderSelect.value = '';
    }
    orderSelect.disabled = isReadOnly;
    orderSelect.style.backgroundColor = isReadOnly ? '#f8fafc' : '#ffffff';
    orderSelect.style.cursor = isReadOnly ? 'default' : '';
  }

  // Populate Dropdown Template BOM Tersimpan (Hanya yang berstatus Accepted)
  const templateSelect = document.getElementById('page-bom-template-select');
  if (templateSelect) {
    let templateOptions = '<option value="">-- Pilih Template BOM Tersimpan (Status Accepted) --</option>';
    let acceptedTemplates = (state.bom || []).filter(b => b.status === 'Accepted');
    if (userRole === 'Member') {
      acceptedTemplates = acceptedTemplates.filter(b => {
        if (b.orderId || b.projectId) {
          return typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(b.orderId || b.projectId, activeUser) : false;
        }
        const userProjects = (state.projects || []).filter(p => typeof isUserAssignedToProject === 'function' ? isUserAssignedToProject(p, activeUser) : false);
        return userProjects.some(p =>
          p.bomId === b.id ||
          (p.projectName && b.productName && p.projectName.toLowerCase().trim() === b.productName.toLowerCase().trim()) ||
          (p.projectName && b.projectName && p.projectName.toLowerCase().trim() === b.projectName.toLowerCase().trim())
        );
      });
    }
    acceptedTemplates.forEach(b => {
      const compCount = b.components?.length || 0;
      const hppStr = formatRupiah(b.totalHPP || b.totalCost || 0);
      templateOptions += `<option value="${b.id}">[${b.id}] ${escapeHtml(b.productName)} (${compCount} Item &bull; HPP ${hppStr})</option>`;
    });
    templateSelect.innerHTML = templateOptions;
    templateSelect.value = '';
    templateSelect.disabled = isReadOnly;
    templateSelect.style.backgroundColor = isReadOnly ? '#f8fafc' : '#ffffff';

    const templateBox = templateSelect.closest('div');
    if (templateBox) {
      templateBox.style.display = isReadOnly ? 'none' : 'block';
    }
  }

  const nameEl = document.getElementById('page-bom-name');
  const codeEl = document.getElementById('page-bom-code');
  const catEl = document.getElementById('page-bom-category');
  const revEl = document.getElementById('page-bom-revision');
  const laborEl = document.getElementById('page-bom-labor');
  const overEl = document.getElementById('page-bom-overhead');
  const notesEl = document.getElementById('page-bom-notes');

  if (nameEl) {
    nameEl.value = isEdit ? (bomData?.productName || '') : (defaultItemName || '');
    nameEl.readOnly = isReadOnly;
    nameEl.style.backgroundColor = isReadOnly ? '#f8fafc' : '#ffffff';
    nameEl.style.cursor = isReadOnly ? 'default' : '';
  }
  if (codeEl) {
    codeEl.value = isEdit ? (bomData?.productCode || '') : (defaultSku || (defaultOrderId ? `PROD-${defaultOrderId}` : ''));
    codeEl.readOnly = isReadOnly;
    codeEl.style.backgroundColor = isReadOnly ? '#f8fafc' : '#ffffff';
    codeEl.style.cursor = isReadOnly ? 'default' : '';
  }
  if (catEl) {
    catEl.value = isEdit ? (bomData?.category || '') : 'General';
    catEl.readOnly = isReadOnly;
    catEl.style.backgroundColor = isReadOnly ? '#f8fafc' : '#ffffff';
    catEl.style.cursor = isReadOnly ? 'default' : '';
  }
  if (revEl) {
    revEl.value = isEdit ? (bomData?.revision || '') : 'v1.0';
    revEl.readOnly = isReadOnly;
    revEl.style.backgroundColor = isReadOnly ? '#f8fafc' : '#ffffff';
    revEl.style.cursor = isReadOnly ? 'default' : '';
  }
  if (laborEl) {
    laborEl.value = isEdit && bomData?.laborCost !== undefined ? bomData.laborCost : '';
    laborEl.readOnly = isReadOnly;
    laborEl.style.backgroundColor = isReadOnly ? '#f8fafc' : '#ffffff';
    laborEl.style.cursor = isReadOnly ? 'default' : '';
  }
  if (overEl) {
    overEl.value = isEdit && bomData?.overheadCost !== undefined ? bomData.overheadCost : '';
    overEl.readOnly = isReadOnly;
    overEl.style.backgroundColor = isReadOnly ? '#f8fafc' : '#ffffff';
    overEl.style.cursor = isReadOnly ? 'default' : '';
  }
  if (notesEl) {
    notesEl.value = isEdit ? (typeof cleanDisplayNotes === 'function' ? cleanDisplayNotes(bomData?.notes || '') : (bomData?.notes || '')) : '';
    notesEl.readOnly = isReadOnly;
    notesEl.style.backgroundColor = isReadOnly ? '#f8fafc' : '#ffffff';
    notesEl.style.cursor = isReadOnly ? 'default' : '';
  }

  // Sembunyikan / Tampilkan tombol pada Struktur Komponen & Bahan Baku
  const compActionBtns = document.getElementById('bom-components-action-btns');
  if (compActionBtns) {
    compActionBtns.style.display = 'flex';
  }
  const addCompBtn = document.getElementById('btn-bom-add-component');
  if (addCompBtn) {
    addCompBtn.style.display = 'inline-flex';
  }
  const bottomAddBtn = document.getElementById('bom-components-bottom-add-btn');
  if (bottomAddBtn) {
    bottomAddBtn.style.display = 'flex';
  }
  document.querySelectorAll('#view-bom-form button[onclick*="openPRPickerModal"], #view-bom-form button[onclick*="redirectToPurchasingPR"]').forEach(btn => {
    btn.style.display = isReadOnly ? 'none' : 'inline-flex';
  });

  // Update Teks Tombol Kembali di Header Atas
  const returnLabel = (state.bomReturnView === 'orders') ? 'Kembali ke Order Penjualan' : 'Kembali ke Daftar BOM';
  const backLinkBtn = document.getElementById('bom-back-link-btn') || document.querySelector('#view-bom-form button[onclick*="navigateBackFromBOM"], #view-bom-form button[onclick*="navigateTo"]');
  if (backLinkBtn) {
    backLinkBtn.setAttribute('onclick', 'navigateBackFromBOM()');
    backLinkBtn.innerHTML = `<i data-lucide="arrow-left"></i> ${returnLabel}`;
  }

  // Update Tombol Action Header Atas
  const headerBtnGroup = document.querySelector('#view-bom-form .card > div:first-child .btn-group');
  if (headerBtnGroup) {
    if (isReadOnly) {
      headerBtnGroup.innerHTML = `
        <button type="button" class="btn btn-primary" onclick="navigateBackFromBOM()"><i data-lucide="arrow-left"></i> ${returnLabel}</button>
      `;
    } else {
      headerBtnGroup.innerHTML = `
        <button type="button" class="btn btn-outline" onclick="navigateBackFromBOM()"><i data-lucide="x"></i> Batal</button>
        <button type="button" class="btn btn-primary" onclick="submitBOMPageForm()"><i data-lucide="save"></i> Simpan Master BOM</button>
      `;
    }
  }

  // Update Tombol Action Footer Bawah
  const bottomActionBar = document.querySelector('#bom-page-form > div:last-child');
  if (bottomActionBar) {
    if (isReadOnly) {
      bottomActionBar.innerHTML = `
        <button type="button" class="btn btn-primary" style="padding: 10px 24px;" onclick="navigateBackFromBOM()"><i data-lucide="arrow-left"></i> ${returnLabel}</button>
      `;
    } else {
      bottomActionBar.innerHTML = `
        <button type="button" class="btn btn-outline" onclick="navigateBackFromBOM()">Batal</button>
        <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-weight: 600;"><i data-lucide="save"></i> Simpan Master BOM</button>
      `;
    }
  }

  const container = document.getElementById('page-bom-components-list');
  if (container) {
    container.innerHTML = '';
    if (bomData && bomData.components && bomData.components.length > 0) {
      bomData.components.forEach(comp => addBOMPageComponentRow(comp, isReadOnly));
    } else {
      renderBOMEmptyState(isReadOnly);
    }
  }

  navigateTo('bom-form');
  calculateBOMPageTotals();
  if (window.lucide) lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function checkInventoryStock(compName, prId = null) {
  if (!compName) return 0;
  const nameClean = compName.toLowerCase().trim();
  let totalStock = 0;
  (state.purchasing || []).forEach(pr => {
    if (pr.status === 'Disetujui' || pr.status === 'Stock' || pr.status === 'Approved') {
      (pr.items || []).forEach(item => {
        if (item.itemStatus === 'Sesuai' && item.itemName && item.itemName.toLowerCase().trim() === nameClean) {
          if (!prId || pr.id === prId) {
            totalStock += (parseFloat(item.qty) || 0);
          }
        }
      });
    }
  });
  return totalStock;
}

function updateBOMStockStatusBanner() {
  const container = document.getElementById('page-bom-components-list');
  if (!container) return;

  const outOfStockBlocks = container.querySelectorAll('.bom-item-block[data-out-of-stock="true"], .bom-item-block.item-out-of-stock');
  let banner = document.getElementById('bom-stock-warning-banner');

  if (outOfStockBlocks.length > 0) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'bom-stock-warning-banner';
      container.parentNode.insertBefore(banner, container);
    }
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="background: #fef2f2; border: 1.5px solid #fca5a5; border-left: 4px solid #ef4444; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i>
          </div>
          <div>
            <div style="font-weight: 700; color: #991b1b; font-size: 13px;">Terdapat ${outOfStockBlocks.length} Komponen dengan Status Stok Kosong (0) di Inventory</div>
            <div style="font-size: 11.5px; color: #b91c1c; margin-top: 2px;">
              Formula BOM <strong>tidak dapat disimpan</strong> selama terdapat bahan baku yang habis di gudang/inventory. Harap ajukan pengadaan melalui tombol <strong>Purchasing</strong>.
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-primary" style="background: #dc2626; border-color: #dc2626; font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;" onclick="redirectToPurchasingPR('OUT_OF_STOCK_ITEMS')">
          <i data-lucide="shopping-cart"></i> Ajukan ke Purchasing
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  } else {
    if (banner) banner.remove();
  }
}

function applyBOMTemplate(templateId) {
  if (!templateId) return;
  const template = (state.bom || []).find(b => b.id === templateId);
  if (!template) return;

  const nameEl = document.getElementById('page-bom-name');
  const codeEl = document.getElementById('page-bom-code');
  const catEl = document.getElementById('page-bom-category');
  const revEl = document.getElementById('page-bom-revision');
  const laborEl = document.getElementById('page-bom-labor');
  const overEl = document.getElementById('page-bom-overhead');
  const notesEl = document.getElementById('page-bom-notes');

  // Jika nama produk belum diisi, gunakan nama dari template
  if (nameEl && !nameEl.value.trim()) {
    nameEl.value = template.productName || '';
  }
  if (codeEl && !codeEl.value.trim() && template.productCode) {
    codeEl.value = `${template.productCode}-COPY`;
  }
  if (catEl && template.category) catEl.value = template.category;
  if (revEl && template.revision) revEl.value = template.revision;
  if (laborEl) laborEl.value = template.laborCost || 0;
  if (overEl) overEl.value = template.overheadCost || 0;
  if (notesEl && !notesEl.value.trim()) {
    notesEl.value = `Disalin dari Template Master BOM ${template.id} (${template.productName})`;
  }

  // Masukkan komponen-komponen bahan baku dari template
  let outOfStockCount = 0;
  const container = document.getElementById('page-bom-components-list');
  if (container && template.components && template.components.length > 0) {
    container.innerHTML = '';
    template.components.forEach(comp => {
      const stock = checkInventoryStock(comp.componentName, comp.prId);
      if (stock <= 0) outOfStockCount++;
      addBOMPageComponentRow(comp, false);
    });
  }

  updateBOMStockStatusBanner();
  calculateBOMPageTotals();
  if (window.lucide) lucide.createIcons();

  if (outOfStockCount > 0) {
    showToast(`⚠️ Template dimuat, namun ${outOfStockCount} komponen berstatus STOK KOSONG di Inventory. BOM tidak dapat disimpan sebelum stok tersedia!`, 'warning');
  } else {
    showToast(`Struktur ${template.components?.length || 0} komponen dari Template ${template.id} berhasil dimuat ke formulir!`, 'success');
  }
}

function openBOMModal(bomData = null, defaultOrderId = null, defaultItemName = null, defaultSku = null) {
  openBOMPage(bomData, defaultOrderId, defaultItemName, defaultSku);
}

function addBOMPageComponentRow(comp = null, isReadOnly = false) {
  const container = document.getElementById('page-bom-components-list');
  if (!container) return;

  // Hapus banner empty state jika ada
  const emptyState = document.getElementById('bom-empty-components');
  if (emptyState) emptyState.remove();

  // Cek ketersediaan stok di Inventory
  const availableStock = checkInventoryStock(comp?.componentName, comp?.prId);
  const isOutOfStock = !isReadOnly && comp && (availableStock <= 0);

  const block = document.createElement('div');
  block.className = `bom-item-block ${isOutOfStock ? 'item-out-of-stock' : ''}`;
  block.dataset.outOfStock = isOutOfStock ? 'true' : 'false';
  block.style.cssText = isOutOfStock
    ? 'background: #fff5f5; border: 1.5px solid #fca5a5; border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 8px; box-sizing: border-box; width: 100%;'
    : 'background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 8px; box-sizing: border-box; width: 100%;';
  
  if (comp?.prId) {
    block.dataset.prId = comp.prId;
    block.dataset.prItemName = comp.componentName || '';
    block.dataset.usedQty = comp.qty || '';
  }

  const gridColumns = isReadOnly ?
    'minmax(0, 2.5fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1.4fr)' :
    'minmax(0, 2.5fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) auto';

  const addedBadgeHtml = comp?.isAddedLater
    ? `<span class="badge badge-success" style="font-size: 9.5px; margin-left: 6px; padding: 2px 7px; font-weight: 700; background: #dcfce7; color: #15803d; border: 1px solid #86efac; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="plus-circle" style="width: 10px; height: 10px;"></i> Tambahan Baru</span>`
    : '';

  const stockBadgeHtml = isOutOfStock
    ? `<span class="badge badge-danger" style="font-size: 10px; margin-left: 6px; padding: 2px 7px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5;"><i data-lucide="alert-triangle" style="width: 11px; height: 11px;"></i> Stok Kosong (0 ${escapeAttr(comp?.unit || 'Pcs')})</span>`
    : (comp ? `<span class="badge badge-success" style="font-size: 9.5px; margin-left: 4px; padding: 1px 6px;">Stok: ${availableStock} ${escapeAttr(comp?.unit || 'Pcs')}</span>` : '');

  block.innerHTML = `
    <div class="item-row" style="margin-bottom: 0; display: grid; grid-template-columns: ${gridColumns}; gap: 10px; align-items: center;">
      <div>
        <label class="form-label font-sm" style="font-size: 11px; margin-bottom: 2px; display: flex; align-items: center; flex-wrap: wrap;">
          Nama Bahan / Komponen ${comp?.prId ? `<span class="badge badge-sm badge-info" style="font-size: 9.5px; margin-left: 4px;">PR: ${comp.prId}</span>` : ''}
          ${addedBadgeHtml}
          ${stockBadgeHtml}
        </label>
        <input type="text" class="form-control bom-comp-name" placeholder="Nama Komponen / Bahan" required value="${escapeAttr(comp?.componentName || '')}" readonly style="background-color: ${isOutOfStock ? '#fef2f2' : '#f8fafc'}; font-weight: 600; cursor: default; ${isOutOfStock ? 'color: #991b1b;' : ''}">
      </div>
      <div>
        <label class="form-label font-sm" style="font-size: 11px; margin-bottom: 2px;">Qty Terpakai *</label>
        <input type="number" class="form-control bom-comp-qty" placeholder="Qty" min="0.01" step="any" required value="${comp ? comp.qty : ''}" ${isReadOnly ? 'readonly style="background-color: #f8fafc; font-weight: 600; cursor: default;"' : 'oninput="calculateBOMPageTotals()"'} >
      </div>
      <div>
        <label class="form-label font-sm" style="font-size: 11px; margin-bottom: 2px;">Satuan</label>
        <input type="text" class="form-control bom-comp-unit" placeholder="Pcs/Roll/Kg" value="${escapeAttr(comp?.unit || '')}" readonly style="background-color: #f8fafc; cursor: default;">
      </div>
      <div>
        <label class="form-label font-sm" style="font-size: 11px; margin-bottom: 2px;">Harga Satuan (Rp)</label>
        <input type="number" class="form-control bom-comp-cost" placeholder="0" required value="${comp ? (comp.unitCost !== undefined ? comp.unitCost : '') : ''}" readonly style="background-color: #f8fafc; cursor: default;" ${isReadOnly ? '' : 'oninput="calculateBOMPageTotals()"'}>
      </div>
      ${isReadOnly ? '' : `
      <div style="padding-top: 16px;">
        <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Komponen" onclick="removeBOMComponentRow(this)"><i data-lucide="trash-2"></i></button>
      </div>`}
    </div>
    ${isOutOfStock ? `
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #fca5a5; font-size: 11px; color: #dc2626; font-weight: 600; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
        <span style="display: inline-flex; align-items: center; gap: 4px;">
          <i data-lucide="alert-circle" style="width: 13px; height: 13px;"></i> Stok bahan baku ini 0 di Inventory. BOM tidak bisa disimpan sebelum diajukan pengadaan.
        </span>
        <button type="button" class="btn btn-sm btn-outline" style="font-size: 10.5px; padding: 2px 8px; color: #dc2626; border-color: #fca5a5; background: #ffffff;" onclick="redirectToPurchasingPR(this)">
          <i data-lucide="shopping-cart"></i> Ajukan ke Purchasing
        </button>
      </div>
    ` : ''}
  `;

  container.appendChild(block);
  updateBOMStockStatusBanner();
  if (window.lucide) lucide.createIcons();
  calculateBOMPageTotals();
}

function removeBOMComponentRow(btnEl) {
  const block = btnEl.closest('.bom-item-block');
  if (!block) return;

  block.remove();
  const remaining = document.querySelectorAll('#page-bom-components-list .bom-item-block');
  if (remaining.length === 0) {
    renderBOMEmptyState();
  }
  updateBOMStockStatusBanner();
  calculateBOMPageTotals();
}

function calculateBOMPageTotals() {
  const blocks = document.querySelectorAll('#page-bom-components-list .bom-item-block');
  let materialCost = 0;
  blocks.forEach(b => {
    const qty = parseFloat(b.querySelector('.bom-comp-qty')?.value) || 0;
    const cost = parseFloat(b.querySelector('.bom-comp-cost')?.value) || 0;
    materialCost += qty * cost;
  });

  const labor = parseFloat(document.getElementById('page-bom-labor')?.value) || 0;
  const overhead = parseFloat(document.getElementById('page-bom-overhead')?.value) || 0;
  const totalHPP = materialCost + labor + overhead;

  const matEl = document.getElementById('page-bom-matcost-calc');
  const opEl = document.getElementById('page-bom-opcost-calc');
  const hppEl = document.getElementById('page-bom-hpp-calc');

  if (matEl) matEl.textContent = formatRupiah(materialCost);
  if (opEl) opEl.textContent = formatRupiah(labor + overhead);
  if (hppEl) hppEl.textContent = formatRupiah(totalHPP);

  return { materialCost, labor, overhead, totalHPP };
}

function submitBOMPageForm() {
  const form = document.getElementById('bom-page-form');
  if (form) {
    if (form.reportValidity()) {
      form.requestSubmit();
    }
  }
}

function autoFillBOMPageFromOrder(selectVal) {
  if (!selectVal) {
    return;
  }
  const parts = selectVal.split('::');
  const orderId = parts[0];
  const itemIdx = parseInt(parts[1], 10);

  const order = (state.orders || []).find(o => o.id === orderId);
  if (order && order.items && order.items[itemIdx]) {
    const item = order.items[itemIdx];
    const nameEl = document.getElementById('page-bom-name');
    const codeEl = document.getElementById('page-bom-code');
    const catEl = document.getElementById('page-bom-category');

    if (nameEl) nameEl.value = item.productName || item.itemName || '';
    if (codeEl) codeEl.value = item.sku || `PROD-${order.id}-${itemIdx + 1}`;
    if (catEl) catEl.value = 'Manufacturing / Custom';
  }
}

async function handleBOMPageSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const editId = document.getElementById('page-bom-edit-id')?.value;
  const orderSelectVal = document.getElementById('page-bom-order-select')?.value || '';
  const orderId = orderSelectVal ? orderSelectVal.split('::')[0] : '';
  const prodName = document.getElementById('page-bom-name')?.value?.trim() || '';

  if (!prodName) {
    showToast('Nama Produk Jadi wajib diisi!', 'warning');
    return;
  }

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const userRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : 'Administrator';

  // Validasi wewenang pembuatan/penyimpanan BOM
  if (!orderId) {
    const canCreateMaster = typeof canUserCreateMasterBOM === 'function' ? canUserCreateMasterBOM(activeUser) : true;
    if (!canCreateMaster) {
      showToast('⚠️ Member tidak memiliki akses untuk membuat atau menyimpan Master BOM. Master BOM hanya bisa dibuat oleh Administrator, Lead Project, dan Ketua UBM.', 'warning');
      return;
    }
  } else {
    const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(orderId, activeUser) : true;
    const canManage = typeof hasRolePermission === 'function' ? hasRolePermission('canManageBOM') : true;
    const isAdminOrKetua = (userRole === 'Administrator' || userRole === 'Ketua UBM' || userRole === 'Wakil Direktur I');
    if (activeUser && !isAdminOrKetua && !canManage && !isLead) {
      showToast('⚠️ Hanya Lead Project yang ditugaskan pada order ini atau Administrator yang berwenang mengisi dan menyimpan BOM.', 'warning');
      return;
    }
  }

  const components = [];
  const blocks = document.querySelectorAll('#page-bom-components-list .bom-item-block');

  blocks.forEach(b => {
    const name = b.querySelector('.bom-comp-name')?.value?.trim();
    const qty = parseFloat(b.querySelector('.bom-comp-qty')?.value) || 0;
    const unit = b.querySelector('.bom-comp-unit')?.value?.trim() || 'Pcs';
    const unitCost = parseFloat(b.querySelector('.bom-comp-cost')?.value) || 0;

    if (name && qty > 0) {
      components.push({
        prId: b.dataset.prId || '',
        itemIndex: b.dataset.itemIndex !== undefined ? parseInt(b.dataset.itemIndex, 10) : undefined,
        componentName: name,
        qty,
        unit,
        unitCost
      });
    }
  });

  if (components.length === 0) {
    showToast('Harap tambahkan minimal 1 komponen/bahan baku untuk Master BOM!', 'warning');
    return;
  }

  // Validasi: Komponen dengan status Stok Kosong di Inventory TIDAK BISA DISIMPAN
  const outOfStockItems = [];
  document.querySelectorAll('#page-bom-components-list .bom-item-block').forEach(b => {
    if (b.dataset.outOfStock === 'true' || b.classList.contains('item-out-of-stock')) {
      const name = b.querySelector('.bom-comp-name')?.value?.trim() || 'Komponen';
      outOfStockItems.push(name);
    }
  });

  if (outOfStockItems.length > 0) {
    showToast(`❌ Tidak dapat menyimpan BOM! Terdapat ${outOfStockItems.length} komponen berstatus "Stok Kosong" (${outOfStockItems.slice(0, 2).join(', ')}${outOfStockItems.length > 2 ? '...' : ''}). Harap ajukan pengadaan melalui tombol Purchasing terlebih dahulu!`, 'error');
    return;
  }

  // Relasi Project & Pelanggan
  let projectId = '';
  let projectName = '';
  let customerName = '';
  if (orderId) {
    const order = (state.orders || []).find(o => o.id === orderId);
    if (order) {
      customerName = order.customerName || '';
    }
    const prj = (state.projects || []).find(p => p.orderId === orderId || p.id === orderId);
    if (prj) {
      projectId = prj.id;
      projectName = prj.projectName || '';
      if (!customerName) customerName = prj.customerName || '';
    }
  }

  // Kalkulasi Biaya
  const laborCost = parseFloat(document.getElementById('page-bom-labor')?.value) || 0;
  const overheadCost = parseFloat(document.getElementById('page-bom-overhead')?.value) || 0;
  const materialCost = components.reduce((sum, c) => sum + ((parseFloat(c.qty) || 0) * (parseFloat(c.unitCost) || 0)), 0);
  const totalEstimatedCost = materialCost + laborCost + overheadCost;

  // Jika editId diisi, berarti mengedit BOM yang sudah ada. Jika editId kosong, berarti membuat pengajuan BOM baru!
  const targetEditId = editId ? editId : null;
  const previousBOM = targetEditId ? (state.bom || []).find(b => b.id === targetEditId) : null;
  const newId = targetEditId || `BOM-2026-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
  const nowIso = new Date().toISOString();
  const todayDate = nowIso.split('T')[0];

  const rawNotes = document.getElementById('page-bom-notes')?.value || '';
  const bomMeta = { orderId, projectId, projectName, customerName };
  const payloadNotes = typeof embedBOMMetaInNotes === 'function'
    ? embedBOMMetaInNotes(rawNotes, bomMeta)
    : rawNotes;

  const payload = {
    id: newId,
    orderId,
    projectId,
    projectName,
    customerName,
    productName: prodName,
    productCode: document.getElementById('page-bom-code')?.value || newId,
    category: document.getElementById('page-bom-category')?.value || 'General',
    revision: document.getElementById('page-bom-revision')?.value || 'v1.0',
    createdDate: previousBOM?.createdDate || todayDate,
    laborCost,
    overheadCost,
    materialCost,
    totalEstimatedCost,
    notes: payloadNotes,
    status: targetEditId ? (previousBOM?.status || 'Pengajuan') : 'Pengajuan',
    components,
    createdAt: previousBOM?.createdAt || nowIso,
    updatedAt: nowIso
  };

  // Optimistic update ke state.bom
  if (!Array.isArray(state.bom)) state.bom = [];
  const existingIdx = state.bom.findIndex(b => b.id === payload.id);
  if (existingIdx !== -1) {
    state.bom[existingIdx] = { ...state.bom[existingIdx], ...payload };
  } else {
    state.bom.unshift(payload);
  }

  // 1. Direct Supabase Upsert Native Table & Cloud Sync Store
  try {
    if (typeof directSupabaseUpsertNativeRow === 'function') {
      await directSupabaseUpsertNativeRow('bom', payload);
    }
    if (typeof directSupabaseSyncResource === 'function') {
      await directSupabaseSyncResource('bom', state.bom);
    }
  } catch (supaErr) {
    console.warn('Direct Supabase BOM sync notice:', supaErr);
  }

  // 2. Simpan ke Backend API Server
  try {
    let res;
    if (targetEditId) {
      res = await fetch(`/api/bom/${targetEditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res && res.ok) {
      const savedBOM = await res.json().catch(() => ({ ...payload, id: targetEditId }));
      
      if (payload.status === 'Accepted') {
        await deductBOMComponentsStock(components);
      }

      // Sinkronisasi HARGA MODAL (HPP) ke Keuangan Project (Profitabilitas Proyek UBM)
      if (typeof window.syncBOMToProjectFinances === 'function') {
        await window.syncBOMToProjectFinances(savedBOM || payload);
      }

      // Otomatis ubah status order terkait ke In Production jika status Accepted
      if (payload.orderId && payload.status === 'Accepted') {
        const targetOrder = (state.orders || []).find(o => o.id === payload.orderId);
        if (targetOrder && (targetOrder.status === 'Accepted' || targetOrder.status === 'Confirmed')) {
          targetOrder.status = 'In Production';
          targetOrder.updatedAt = new Date().toISOString();
          fetch(`/api/orders/${targetOrder.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(targetOrder)
          }).catch(e => console.warn('Sync order status to In Production error:', e));
        }
      }

      // Tutup semua popup & modal yang mungkin terbuka
      closeModal('form-modal');
      closeModal('pr-picker-modal');

      showToast(`Master BOM berhasil ${targetEditId ? 'diperbarui' : 'disimpan'} ke database! (Status: ${payload.status})`, 'success');
      await fetchResource('bom');
      await fetchResource('purchasing');
      await fetchResource('projects');
      
      // Otomatis arahkan dan buka halaman BOM
      navigateTo('bom');
      if (payload.orderId) {
        switchBOMTab('orders');
      } else {
        switchBOMTab('master');
      }
      renderBOMTable();
      renderOrdersTable();
      if (typeof renderPurchasingTable === 'function') renderPurchasingTable();
      if (typeof renderPurchasingProcessTable === 'function') renderPurchasingProcessTable();
      if (typeof renderPurchasingItemsTable === 'function') renderPurchasingItemsTable();
      updateSidebarBadges();
    } else {
      // Fallback: direct Supabase upsert sudah tersimpan
      closeModal('form-modal');
      closeModal('pr-picker-modal');
      showToast(`Master BOM berhasil tersimpan ke database Supabase! (Status: ${payload.status})`, 'success');
      navigateTo('bom');
      if (payload.orderId) {
        switchBOMTab('orders');
      } else {
        switchBOMTab('master');
      }
      renderBOMTable();
    }
  } catch (err) {
    console.error('Error saving BOM:', err);
    closeModal('form-modal');
    closeModal('pr-picker-modal');
    showToast(`Master BOM berhasil disimpan ke database lokal & Supabase! (Status: ${payload.status})`, 'success');
    navigateTo('bom');
    if (payload.orderId) {
      switchBOMTab('orders');
    } else {
      switchBOMTab('master');
    }
    renderBOMTable();
  }
}

function viewBOMDetail(bomId) {
  const bom = state.bom.find(b => b.id === bomId);
  if (!bom) return;

  const isAccepted = bom.status === 'Accepted';
  const statusBadge = isAccepted ?
    '<span class="badge badge-success" style="font-size: 10.5px; padding: 3px 8px;"><i data-lucide="check-circle" style="width: 11px; height: 11px;"></i> Accepted</span>' :
    '<span class="badge badge-amber" style="font-size: 10.5px; padding: 3px 8px;"><i data-lucide="clock" style="width: 11px; height: 11px;"></i> Pengajuan</span>';

  const materialCost = (bom.components || []).reduce((sum, c) => sum + ((c.qty || 0) * (c.unitCost || 0)), 0);
  const labor = bom.laborCost || 0;
  const overhead = bom.overheadCost || 0;
  const totalHPP = materialCost + labor + overhead;

  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'Unit Bisnis Mandiri (UBM) Politeknik Takumi',
    tagline: 'Engineering, Manufacturing, & Automation Solutions',
    address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Bekasi'
  };

  const content = document.getElementById('preview-modal-content');
  content.innerHTML = `
    <div class="doc-preview">
      <div class="doc-header">
        <div>
          <div class="company-name">${escapeHtml(compSettings.companyName)}</div>
          <div class="text-muted font-sm">${escapeHtml(compSettings.tagline)}</div>
          <div class="font-xs text-muted" style="margin-top: 2px;">${escapeHtml(compSettings.address || '')}</div>
        </div>
        <div class="text-right">
          <h2 style="font-size: 20px; font-weight: 800; color: #1e293b;">MASTER BILL OF MATERIALS</h2>
          <div class="font-mono font-bold text-primary">${bom.id}</div>
          <div class="font-sm text-muted" style="margin-top: 4px; display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
            ${statusBadge} &bull; Revisi: ${bom.revision || 'v1.0'}
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; padding: 14px; background: #f8fafc; border-radius: 6px;">
        <div>
          <div class="font-sm font-bold text-muted">PRODUK JADI / TARGET PERAKITAN:</div>
          <div class="font-bold text-main" style="font-size: 15px;">${bom.productName}</div>
          <div class="font-mono font-sm text-muted">SKU/Kode: ${bom.productCode || '-'}</div>
          <div>Kategori: <span class="badge badge-purple">${bom.category || 'General'}</span></div>
        </div>
        <div class="text-right">
          <div class="font-sm font-bold text-muted">ESTIMASI BIAYA & HPP:</div>
          <div>Biaya Material: <strong>${formatRupiah(materialCost)}</strong></div>
          <div>Tenaga Kerja & Overhead: <strong>${formatRupiah(labor + overhead)}</strong></div>
          <div style="margin-top: 4px; font-size: 14px;">Total Estimasi HPP: <strong class="text-emerald" style="font-size: 16px;">${formatRupiah(totalHPP)}</strong></div>
        </div>
      </div>

      <h4 style="margin-bottom: 10px; font-size: 13px;">Rincian Komponen & Bahan Baku</h4>
      <table class="doc-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Komponen / Bahan</th>
            <th class="text-center">Kuantitas (Qty)</th>
            <th class="text-center">Satuan</th>
            <th class="text-right">Biaya Satuan</th>
            <th class="text-right">Total Biaya</th>
          </tr>
        </thead>
        <tbody>
          ${(bom.components || []).map((c, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td class="font-bold">${c.componentName}</td>
              <td class="text-center font-bold">${c.qty}</td>
              <td class="text-center">${c.unit || 'Pcs'}</td>
              <td class="text-right">${formatRupiah(c.unitCost)}</td>
              <td class="text-right font-bold">${formatRupiah((c.qty || 0) * (c.unitCost || 0))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${(bom.notes && (typeof cleanDisplayNotes === 'function' ? cleanDisplayNotes(bom.notes) : bom.notes)) ? `<div class="mt-4 p-3 bg-light rounded font-sm"><strong>Instruksi / Catatan Produksi:</strong> ${escapeHtml(typeof cleanDisplayNotes === 'function' ? cleanDisplayNotes(bom.notes) : bom.notes)}</div>` : ''}

      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; text-align: center;">
        <div>
          <div class="font-sm text-muted">Disusun Oleh (Engineering),</div>
          <div style="margin-top: 50px; font-weight: bold;">( Product Engineer )</div>
        </div>
        <div>
          <div class="font-sm text-muted">Disetujui Oleh (Production Head),</div>
          <div style="margin-top: 50px; font-weight: bold;">( Production Manager )</div>
        </div>
      </div>
    </div>
  `;

  openModal('preview-modal');
}

function editBOM(bomId) {
  const bom = (state.bom || []).find(b => b.id === bomId);
  if (!bom) return;

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const userRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || 'Member');
  const isLead = typeof isUserProjectLead === 'function' ? isUserProjectLead(bom.orderId || bom.projectId, activeUser) : false;
  const canEdit = (userRole === 'Administrator' || userRole === 'Ketua UBM' || userRole === 'Wakil Direktur I' || isLead);

  if (!canEdit) {
    showToast('⚠️ Member hanya dapat melihat struktur BOM. Pengubahan hanya dapat dilakukan oleh Administrator, Lead Project, dan Ketua UBM.', 'info');
    viewBOMDetail(bomId);
    return;
  }

  const isLocked = bom.status === 'Accepted';
  openBOMPage(bom, bom.orderId, bom.productName, bom.productCode, isLocked);
}
window.deductBOMComponentsStock = deductBOMComponentsStock;

// =========================================================================
// PENAMBAHAN KOMPONEN TAMBAHAN LANGSUNG PADA FORMULIR MASTER BOM
// (Tanpa Merubah Komponen yang Sudah Ada Sebelumnya - Hanya Menambahkan)
// =========================================================================

function openAddBOMComponentModal() {
  const editId = document.getElementById('page-bom-edit-id')?.value;
  const orderSelectVal = document.getElementById('page-bom-order-select')?.value || '';
  const currentOrderId = orderSelectVal ? orderSelectVal.split('::')[0] : '';

  const boundBOM = currentActiveBOMPageData || 
    (editId ? (state.bom || []).find(b => b.id === editId) : null) ||
    (currentOrderId ? (state.bom || []).find(b => b.orderId === currentOrderId) : null);

  const orderId = boundBOM?.orderId || currentOrderId || '';
  const productName = boundBOM?.productName || document.getElementById('page-bom-name')?.value || 'Produk BOM';

  const modal = document.getElementById('form-modal');
  const modalBody = modal?.querySelector('.modal-body') || modal;
  if (!modalBody) return;

  const masterList = typeof getMasterItemsList === 'function' ? getMasterItemsList() : [];
  
  // Kumpulkan komponen yang saat ini ada di formulir
  const existingComponents = [];
  document.querySelectorAll('#page-bom-components-list .bom-item-block').forEach(b => {
    const name = b.querySelector('.bom-comp-name')?.value?.trim();
    const qty = parseFloat(b.querySelector('.bom-comp-qty')?.value) || 0;
    const unit = b.querySelector('.bom-comp-unit')?.value?.trim() || 'Pcs';
    const unitCost = parseFloat(b.querySelector('.bom-comp-cost')?.value) || 0;
    if (name) {
      existingComponents.push({ componentName: name, qty, unit, unitCost });
    }
  });

  modalBody.innerHTML = `
    <div style="font-family: 'Inter', system-ui, sans-serif; max-height: 85vh; overflow-y: auto; padding-right: 4px;">
      <!-- HEADER MODAL -->
      <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="boxes" style="color: #059669; width: 22px; height: 22px;"></i>
              Tambah Komponen ke Master BOM
            </h3>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">
              Produk: <strong>${escapeHtml(productName)}</strong> &bull; Ref Order: <span class="font-mono">${escapeHtml(orderId || '-')}</span> ${boundBOM?.id ? `&bull; BOM: <span class="font-mono font-bold text-success">${escapeHtml(boundBOM.id)} (${boundBOM.status || 'Accepted'})</span>` : ''}
            </p>
          </div>
          <span class="badge badge-success" style="font-size: 10.5px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="shield-check" style="width: 12px; height: 12px;"></i> Komponen Sebelumnya Terkunci &amp; Utuh
          </span>
        </div>
      </div>

      <!-- FORMULIR INPUT KOMPONEN -->
      <form id="form-bom-add-component-dialog" onsubmit="event.preventDefault();" style="display: flex; flex-direction: column; gap: 14px;">
        <datalist id="bom-master-items-datalist">
          ${masterList.map(m => `<option value="${escapeAttr(m.itemName)}">${escapeAttr(m.itemName)} (${m.specs ? escapeAttr(m.specs) + ' | ' : ''}Stok Tersedia: ${m.qty} ${m.unit} | Rp ${Number(m.unitCost || 0).toLocaleString('id-ID')})</option>`).join('')}
        </datalist>

        <div class="form-group" style="margin: 0;">
          <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
            Nama Komponen / Bahan Baku <span class="text-danger">*</span>
          </label>
          <input type="text" id="input-bom-modal-comp-name" class="form-control" list="bom-master-items-datalist" placeholder="Ketik atau pilih dari Master Barang Inventory..." oninput="handleBOMComponentModalInput()" required autocomplete="off" style="font-weight: 600; font-size: 13px;">
          <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
            💡 Anda dapat memilih dari Database Master Barang atau mengetik nama material baru.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1.5fr; gap: 12px;">
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Spesifikasi Teknis
            </label>
            <input type="text" id="input-bom-modal-comp-specs" class="form-control" placeholder="Tipe, ukuran, material..." style="font-size: 12px;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Satuan
            </label>
            <input type="text" id="input-bom-modal-comp-unit" class="form-control" value="Pcs" placeholder="Pcs, Set, Mtr..." style="font-size: 12px;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Jumlah Dibutuhkan (Qty) <span class="text-danger">*</span>
            </label>
            <input type="number" id="input-bom-modal-comp-qty" class="form-control font-mono font-bold" min="1" step="any" value="1" oninput="handleBOMComponentModalInput()" required style="font-size: 13px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1.5fr 1.5fr; gap: 12px;">
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Estimasi Biaya Satuan (Rp)
            </label>
            <input type="number" id="input-bom-modal-comp-cost" class="form-control font-mono" min="0" value="0" oninput="handleBOMComponentModalInput()" style="font-size: 13px;">
          </div>
          <div class="form-group" style="margin: 0;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
              Estimasi Subtotal Biaya
            </label>
            <div id="preview-bom-modal-comp-subtotal" class="form-control font-mono font-bold" style="background: #f8fafc; font-size: 14px; color: #059669; display: flex; align-items: center;">
              Rp 0
            </div>
          </div>
        </div>

        <div class="form-group" style="margin: 0;">
          <label style="display: block; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
            Keterangan Kebutuhan / Catatan Penambahan
          </label>
          <textarea id="input-bom-modal-comp-notes" class="form-control" rows="2" placeholder="Alasan penambahan komponen, modifikasi wiring, perkuatan struktur, dll..." style="font-size: 12px;"></textarea>
        </div>

        <!-- LIVE STOCK FEEDBACK BOX -->
        <div id="bom-modal-comp-stock-feedback">
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #64748b; font-size: 12px;">
            Ketik atau pilih nama komponen di atas untuk memeriksa ketersediaan stok di Inventory.
          </div>
        </div>

        <!-- MODAL ACTION BUTTONS -->
        <div id="bom-modal-comp-actions" style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 4px;">
          <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        </div>
      </form>

      <!-- REFERENSI: KOMPONEN YANG SUDAH ADA SEBELUMNYA (TETAP UTUH & TERKUNCI) -->
      ${existingComponents.length > 0 ? `
        <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
          <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>Komponen yang Sudah Ada Sebelumnya (${existingComponents.length} Material - Tidak Berubah):</span>
            <span class="text-muted font-xs">Total Biaya Bahan: <strong>${typeof formatRupiah === 'function' ? formatRupiah(existingComponents.reduce((s, c) => s + (c.qty * c.unitCost), 0)) : 'Rp 0'}</strong></span>
          </div>
          <div class="table-responsive" style="max-height: 140px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
            <table class="data-table" style="font-size: 11px; margin: 0; width: 100%;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="padding: 5px 8px;">No</th>
                  <th style="padding: 5px 8px;">Komponen</th>
                  <th style="padding: 5px 8px; text-align: center;">Qty</th>
                  <th style="padding: 5px 8px; text-align: right;">Biaya</th>
                  <th style="padding: 5px 8px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${existingComponents.map((c, i) => `
                  <tr>
                    <td style="padding: 5px 8px;">${i + 1}</td>
                    <td style="padding: 5px 8px; font-weight: 600;">${escapeHtml(c.componentName || c.itemName || '-')}</td>
                    <td style="padding: 5px 8px; text-align: center;" class="font-mono">${c.qty} ${c.unit || 'Pcs'}</td>
                    <td style="padding: 5px 8px; text-align: right;" class="font-mono">${typeof formatRupiah === 'function' ? formatRupiah(c.unitCost || 0) : c.unitCost}</td>
                    <td style="padding: 5px 8px; text-align: center;"><span class="badge badge-secondary" style="font-size: 9.5px; padding: 1px 5px;"><i data-lucide="lock" style="width: 10px; height: 10px;"></i> Terkunci</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

function handleBOMComponentModalInput() {
  const nameInput = document.getElementById('input-bom-modal-comp-name');
  const qtyInput = document.getElementById('input-bom-modal-comp-qty');
  const costInput = document.getElementById('input-bom-modal-comp-cost');
  const unitInput = document.getElementById('input-bom-modal-comp-unit');
  const specsInput = document.getElementById('input-bom-modal-comp-specs');
  const feedback = document.getElementById('bom-modal-comp-stock-feedback');
  const previewSubtotal = document.getElementById('preview-bom-modal-comp-subtotal');
  const actionContainer = document.getElementById('bom-modal-comp-actions');

  if (!nameInput || !feedback) return;

  const rawName = nameInput.value?.trim() || '';
  const nameLower = rawName.toLowerCase();
  const qty = Math.max(1, parseFloat(qtyInput?.value) || 1);

  const masterList = typeof getMasterItemsList === 'function' ? getMasterItemsList() : [];
  const matched = masterList.find(m => m.itemName.toLowerCase().trim() === nameLower);

  if (matched) {
    if (unitInput && !unitInput.dataset.manualEdited) unitInput.value = matched.unit || 'Pcs';
    if (costInput && (!costInput.value || costInput.value === '0')) costInput.value = matched.unitCost || 0;
    if (specsInput && !specsInput.value && matched.specs) specsInput.value = matched.specs;
  }

  const unitCost = parseFloat(costInput?.value) || (matched?.unitCost || 0);
  const subtotal = qty * unitCost;
  if (previewSubtotal) {
    previewSubtotal.textContent = typeof formatRupiah === 'function' ? formatRupiah(subtotal) : `Rp ${subtotal.toLocaleString('id-ID')}`;
  }

  if (!rawName) {
    feedback.innerHTML = `
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #64748b; font-size: 12px;">
        Ketik atau pilih nama komponen di atas untuk memeriksa ketersediaan stok di Inventory.
      </div>
    `;
    if (actionContainer) actionContainer.innerHTML = `<button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>`;
    return;
  }

  const availableStock = matched ? (parseFloat(matched.qty) || 0) : 0;
  const unit = (unitInput?.value || matched?.unit || 'Pcs').trim();

  if (matched && availableStock >= qty) {
    // KONDISI 1: ADA DI INVENTORY DAN STOK CUKUP
    feedback.innerHTML = `
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: #15803d; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="check-circle" style="width: 16px; height: 16px;"></i> Stok Tersedia di Inventory: <strong>${availableStock} ${unit}</strong>
          </span>
          <span class="badge badge-success" style="font-size: 10.5px;">✓ Siap Digunakan Langsung</span>
        </div>
        <div style="font-size: 11.5px; color: #166534; margin-top: 5px;">
          Komponen <strong>${escapeHtml(matched.itemName)}</strong> tersedia di Master Barang. Klik tombol hijau di bawah untuk <strong>langsung menambahkan ${qty} ${unit} ke BOM ini</strong> tanpa merubah komponen sebelumnya, dan stok inventory otomatis terpotong.
        </div>
      </div>
    `;
    if (actionContainer) {
      actionContainer.innerHTML = `
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="button" class="btn btn-success" style="background: #059669; border-color: #059669; padding: 9px 20px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="executeAddDirectComponentToBOMPage()">
          <i data-lucide="check-circle"></i> Gunakan Langsung & Tambah ke BOM (${qty} ${unit})
        </button>
      `;
    }
  } else {
    // KONDISI 2: TIDAK ADA DI INVENTORY ATAU STOK TIDAK CUKUP
    const statusText = matched ? `Stok Kurang (Tersedia: ${availableStock} ${unit}, Dibutuhkan: ${qty} ${unit})` : 'Belum Ada di Inventory (Stok: 0)';
    feedback.innerHTML = `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: #b45309; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="alert-triangle" style="width: 16px; height: 16px;"></i> ${statusText}
          </span>
          <span class="badge badge-amber" style="font-size: 10.5px; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;">Pengajuan Purchasing Diperlukan</span>
        </div>
        <div style="font-size: 11.5px; color: #92400e; margin-top: 5px;">
          Stok barang tidak mencukupi di inventory untuk kebutuhan BOM ini. Klik tombol di bawah untuk <strong>otomatis mengajukan Request Pengadaan (Purchasing)</strong>.
        </div>
      </div>
    `;
    if (actionContainer) {
      actionContainer.innerHTML = `
        <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
        <button type="button" class="btn btn-primary" style="background: #d97706; border-color: #d97706; padding: 9px 20px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="executeSubmitPurchasingFromBOMPage()">
          <i data-lucide="shopping-cart"></i> Ajukan Pengadaan Purchasing (${qty} ${unit})
        </button>
      `;
    }
  }

  if (window.lucide) lucide.createIcons();
}

async function executeAddDirectComponentToBOMPage() {
  const editId = document.getElementById('page-bom-edit-id')?.value;
  const orderSelectVal = document.getElementById('page-bom-order-select')?.value || '';
  const currentOrderId = orderSelectVal ? orderSelectVal.split('::')[0] : '';

  const boundBOM = currentActiveBOMPageData || 
    (editId ? (state.bom || []).find(b => b.id === editId) : null) ||
    (currentOrderId ? (state.bom || []).find(b => b.orderId === currentOrderId) : null);

  const nameInput = document.getElementById('input-bom-modal-comp-name');
  const qtyInput = document.getElementById('input-bom-modal-comp-qty');
  const costInput = document.getElementById('input-bom-modal-comp-cost');
  const unitInput = document.getElementById('input-bom-modal-comp-unit');
  const specsInput = document.getElementById('input-bom-modal-comp-specs');
  const notesInput = document.getElementById('input-bom-modal-comp-notes');

  const itemName = (nameInput?.value || '').trim();
  const qty = parseFloat(qtyInput?.value) || 0;
  const unit = (unitInput?.value || 'Pcs').trim();
  const unitCost = parseFloat(costInput?.value) || 0;
  const specs = (specsInput?.value || '').trim();
  const notes = (notesInput?.value || '').trim();

  if (!itemName) {
    showToast('Harap masukkan nama komponen', 'warning');
    return;
  }
  if (qty <= 0) {
    showToast('Jumlah (Qty) komponen harus lebih dari 0', 'warning');
    return;
  }

  const masterList = typeof getMasterItemsList === 'function' ? getMasterItemsList() : [];
  const mItem = masterList.find(m => m.itemName.toLowerCase().trim() === itemName.toLowerCase().trim());
  const availableStock = mItem ? (parseFloat(mItem.qty) || 0) : 0;

  if (!mItem || availableStock < qty) {
    showToast(`⚠️ Stok di inventory tidak mencukupi (${availableStock} ${unit}). Silakan klik tombol Ajukan Pengadaan Purchasing!`, 'warning');
    return;
  }

  const newComponent = {
    componentName: itemName,
    specs: specs || (mItem?.specs || ''),
    qty: qty,
    unit: unit || (mItem?.unit || 'Pcs'),
    unitCost: unitCost || (mItem?.unitCost || 0),
    prId: mItem?.sourcePrId || '',
    notes: notes || 'Komponen tambahan',
    isAddedLater: true
  };

  try {
    if (boundBOM && boundBOM.id) {
      // BOM SUDAH TERSIMPAN DI DATABASE: Tambahkan tanpa merubah komponen sebelumnya
      if (!Array.isArray(boundBOM.components)) boundBOM.components = [];

      const existingIdx = boundBOM.components.findIndex(c => 
        (c.componentName || c.itemName || '').toLowerCase().trim() === itemName.toLowerCase().trim()
      );

      if (existingIdx !== -1) {
        boundBOM.components[existingIdx].qty = (parseFloat(boundBOM.components[existingIdx].qty) || 0) + qty;
        if (unitCost > 0) boundBOM.components[existingIdx].unitCost = unitCost;
        if (specs) boundBOM.components[existingIdx].specs = specs;
        if (notes) boundBOM.components[existingIdx].notes = (boundBOM.components[existingIdx].notes ? `${boundBOM.components[existingIdx].notes}; ` : '') + notes;
        boundBOM.components[existingIdx].isAddedLater = true;
      } else {
        boundBOM.components.push(newComponent);
      }

      // Hitung ulang HPP
      boundBOM.materialCost = boundBOM.components.reduce((sum, c) => sum + ((parseFloat(c.qty) || 0) * (parseFloat(c.unitCost) || 0)), 0);
      boundBOM.totalEstimatedCost = boundBOM.materialCost + (parseFloat(boundBOM.laborCost) || 0) + (parseFloat(boundBOM.overheadCost) || 0);
      boundBOM.updatedAt = new Date().toISOString();

      // Simpan ke API
      const res = await fetch(`/api/bom/${boundBOM.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boundBOM)
      });
      if (!res.ok) throw new Error('Gagal memperbarui data BOM di server');

      // Potong stok inventory & sync Supabase
      if (typeof deductBOMComponentsStock === 'function') {
        await deductBOMComponentsStock([newComponent]);
      }

      // Update dan sinkronisasi HARGA MODAL (HPP) ke Keuangan Project (Profitabilitas Proyek UBM)
      if (typeof window.syncBOMToProjectFinances === 'function') {
        await window.syncBOMToProjectFinances(boundBOM);
      }

      // Re-render UI komponen di formulir BOM (komponen sebelumnya tetap terkunci)
      const isLocked = boundBOM.status === 'Accepted' || Boolean(boundBOM.orderId);
      const container = document.getElementById('page-bom-components-list');
      if (container) {
        container.innerHTML = '';
        boundBOM.components.forEach(c => addBOMPageComponentRow(c, isLocked));
      }

      if (typeof fetchResource === 'function') {
        await Promise.allSettled([
          fetchResource('bom'),
          fetchResource('master_items'),
          fetchResource('purchasing'),
          fetchResource('project_finances')
        ]);
      }

      closeModal('form-modal');
      showToast(`✅ Komponen "${itemName}" (${qty} ${unit}) berhasil ditambahkan ke Master BOM tanpa merubah komponen sebelumnya!`, 'success');
      calculateBOMPageTotals();
    } else {
      // DRAFT FORM BOM BARU: Tambahkan baris komponen ke formulir
      addBOMPageComponentRow(newComponent, false);
      closeModal('form-modal');
      showToast(`✅ Komponen "${itemName}" (${qty} ${unit}) ditambahkan ke formulir!`, 'success');
      calculateBOMPageTotals();
    }
  } catch (err) {
    console.error('Error adding component to BOM:', err);
    showToast('Gagal menambahkan komponen: ' + err.message, 'error');
  }
}

async function executeSubmitPurchasingFromBOMPage() {
  const editId = document.getElementById('page-bom-edit-id')?.value;
  const orderSelectVal = document.getElementById('page-bom-order-select')?.value || '';
  const currentOrderId = orderSelectVal ? orderSelectVal.split('::')[0] : '';

  const boundBOM = currentActiveBOMPageData || 
    (editId ? (state.bom || []).find(b => b.id === editId) : null) ||
    (currentOrderId ? (state.bom || []).find(b => b.orderId === currentOrderId) : null);

  const orderId = boundBOM?.orderId || currentOrderId || '';
  const productName = boundBOM?.productName || document.getElementById('page-bom-name')?.value || 'Produk BOM';

  const nameInput = document.getElementById('input-bom-modal-comp-name');
  const qtyInput = document.getElementById('input-bom-modal-comp-qty');
  const costInput = document.getElementById('input-bom-modal-comp-cost');
  const unitInput = document.getElementById('input-bom-modal-comp-unit');
  const specsInput = document.getElementById('input-bom-modal-comp-specs');
  const notesInput = document.getElementById('input-bom-modal-comp-notes');

  const itemName = (nameInput?.value || '').trim();
  const qty = parseFloat(qtyInput?.value) || 0;
  const unit = (unitInput?.value || 'Pcs').trim();
  const unitCost = parseFloat(costInput?.value) || 0;
  const specs = (specsInput?.value || '').trim();
  const notes = (notesInput?.value || '').trim();

  if (!itemName) {
    showToast('Harap masukkan nama komponen', 'warning');
    return;
  }
  if (qty <= 0) {
    showToast('Jumlah (Qty) komponen harus lebih dari 0', 'warning');
    return;
  }

  const authUser = typeof getAuthUser === 'function' ? getAuthUser() : null;
  const newPrId = `PR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(100 + Math.random() * 900)}`;

  const newPR = {
    id: newPrId,
    orderId: orderId || '',
    projectId: boundBOM?.projectId || '',
    projectName: productName || '',
    bomId: boundBOM?.id || '',
    requestor: authUser?.name || 'Lead Project',
    department: authUser?.department || 'Engineering & Produksi',
    requestDate: new Date().toISOString().split('T')[0],
    requiredDate: '',
    urgency: 'High',
    status: 'Pending',
    purpose: `Pengadaan Bahan Tambahan BOM: ${productName} (Ref Order: ${orderId || '-'})`,
    notes: notes ? `${notes} [Untuk BOM: ${boundBOM?.id || productName}]` : `Kebutuhan komponen tambahan untuk BOM: ${boundBOM?.id || productName}`,
    items: [
      {
        itemName: itemName,
        specs: specs || '',
        qty: qty,
        unit: unit || 'Pcs',
        estimatedPrice: unitCost || 0,
        actualPrice: unitCost || 0,
        total: qty * (unitCost || 0),
        itemStatus: 'Belum Dipesan'
      }
    ],
    totalEstimated: qty * (unitCost || 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    const res = await fetch('/api/purchasing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPR)
    });
    if (!res.ok) throw new Error('Gagal mengirim pengajuan purchasing ke server');
    const saved = await res.json();
    state.purchasing = state.purchasing || [];
    state.purchasing.unshift(saved || newPR);

    closeModal('form-modal');
    showToast(`📋 Pengajuan Purchasing #${newPrId} berhasil dibuat untuk ${itemName} (${qty} ${unit})! Menunggu proses pembelian & stok masuk.`, 'success');
    if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
  } catch (err) {
    console.error('Error submitting purchasing:', err);
    showToast('Gagal mengajukan purchasing: ' + err.message, 'error');
  }
}

window.openAddBOMComponentModal = openAddBOMComponentModal;
window.handleBOMComponentModalInput = handleBOMComponentModalInput;
window.executeAddDirectComponentToBOMPage = executeAddDirectComponentToBOMPage;
window.executeSubmitPurchasingFromBOMPage = executeSubmitPurchasingFromBOMPage;
