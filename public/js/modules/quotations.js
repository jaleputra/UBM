// =========================================================
// UBM - Quotations Module (Surat Penawaran Harga)
// =========================================================

function isQuotationDraft(quo) {
  if (!quo) return false;
  return quo.status === 'Draft' || Boolean(quo.isDraft);
}
window.isQuotationDraft = isQuotationDraft;

function getQuotationDisplayNotes(notes) {
  if (typeof cleanDisplayNotes === 'function') return cleanDisplayNotes(notes);
  return String(notes || '').replace(/<!--[\s\S]*?-->/g, '').trim();
}

function isQuotationReadOnlyForUser(user = null) {
  const activeUser = user || (typeof getAuthUser === 'function' ? getAuthUser() : (typeof getLoggedInUser === 'function' ? getLoggedInUser() : null));
  const currentRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || '');
  return currentRole === 'PPIC';
}
window.isQuotationReadOnlyForUser = isQuotationReadOnlyForUser;

// Helper: Draft Quotation hanya dapat dilihat oleh pembuat draft itu sendiri dan Administrator
function isQuotationVisibleToUser(quo, user = null) {
  if (!quo) return false;
  if (!isQuotationDraft(quo)) return true;

  const activeUser = user || (typeof getAuthUser === 'function' ? getAuthUser() : (typeof getLoggedInUser === 'function' ? getLoggedInUser() : null));
  if (!activeUser) return false;

  const currentRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || '');
  if (currentRole === 'Administrator') return true;

  const creator = String(quo.createdBy || '').trim().toLowerCase();
  if (!creator) return false;

  const userEmail = String(activeUser.email || '').trim().toLowerCase();
  const userName = String(activeUser.name || '').trim().toLowerCase();
  const userId = String(activeUser.id || '').trim().toLowerCase();

  return Boolean(
    (userEmail && creator === userEmail) ||
    (userName && creator === userName) ||
    (userId && creator === userId)
  );
}
window.isQuotationVisibleToUser = isQuotationVisibleToUser;

// Helper: Persist Quotation secara ganda (API Server + Supabase Native Table + Cloud Sync)
async function persistQuotationRecord(quoItem, isEditMode = false) {
  if (!quoItem || !quoItem.id) {
    return { ok: false, error: 'ID Quotation tidak valid' };
  }

  if (!Array.isArray(state.quotations)) state.quotations = [];
  const existingIdx = state.quotations.findIndex(q => q.id === quoItem.id);
  if (existingIdx !== -1) {
    state.quotations[existingIdx] = { ...state.quotations[existingIdx], ...quoItem };
  } else {
    state.quotations.unshift(quoItem);
  }

  let apiOk = false;
  let apiErrorMsg = '';
  let finalRecord = quoItem;

  try {
    const url = isEditMode ? `/api/quotations/${quoItem.id}` : '/api/quotations';
    const method = isEditMode ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoItem)
    });

    if (res.ok) {
      apiOk = true;
      const saved = await res.json().catch(() => null);
      if (saved && typeof saved === 'object' && saved.id) {
        finalRecord = saved;
        const idxAfter = state.quotations.findIndex(q => q.id === saved.id);
        if (idxAfter !== -1) state.quotations[idxAfter] = saved;
      }
    } else {
      const errBody = await res.json().catch(() => ({}));
      apiErrorMsg = errBody.error || errBody.message || '';
      // Jika ditolak karena aturan bisnis (misal 400/403), hentikan langsung
      if (res.status >= 400 && res.status < 500 && apiErrorMsg) {
        return { ok: false, status: res.status, error: apiErrorMsg };
      }
    }
  } catch (err) {
    apiErrorMsg = err.message || 'Gagal menghubungi API server';
  }

  // Pastikan tersimpan langsung di tabel native public.quotations Supabase & Cloud Sync Store
  let nativeOk = Boolean(finalRecord?._syncedNative);
  if (!nativeOk && typeof directSupabaseUpsertNativeRow === 'function') {
    nativeOk = await directSupabaseUpsertNativeRow('quotations', finalRecord).catch(() => false);
  }
  let cloudOk = false;
  if (typeof directSupabaseSyncResource === 'function') {
    cloudOk = await directSupabaseSyncResource('quotations', state.quotations).catch(() => false);
  }

  if (apiOk || nativeOk || cloudOk) {
    return { ok: true, data: finalRecord, syncedNative: nativeOk, syncedCloud: cloudOk, viaApi: apiOk };
  }
  return { ok: false, error: apiErrorMsg || 'Gagal menyimpan Quotation ke Supabase maupun server lokal' };
}

// Helper: Memeriksa apakah Quotation telah disetujui lengkap oleh Ketua UBM dan Direktur
function isQuotationDualApproved(quo) {
  if (!quo || isQuotationDraft(quo)) return false;
  if (typeof ensureQuotationApprovalData === 'function') {
    ensureQuotationApprovalData(quo);
  }
  return Boolean(quo.approvalKetuaUbm && quo.approvalDirektur);
}

function promptQuotationDualApprovalRequired(id) {
  const quo = (state.quotations || []).find(q => q.id === id);
  if (!quo) return;
  if (isQuotationDraft(quo)) {
    showToast(`📝 Quotation #${quo.id} masih berstatus Draft (Belum Terbit). Klik "Terbitkan" atau "Simpan & Terbitkan Quotation" terlebih dahulu agar dikirim ke Ketua UBM & Direktur.`, 'warning');
    return;
  }
  if (typeof ensureQuotationApprovalData === 'function') {
    ensureQuotationApprovalData(quo);
  }
  let missing = [];
  if (!quo.approvalKetuaUbm) missing.push('Ketua UBM');
  if (!quo.approvalDirektur) missing.push('Direktur');
  showToast(`⚠️ Surat Penawaran #${quo.id} belum disetujui lengkap!\nMemerlukan persetujuan resmi dari: ${missing.join(' dan ')} sebelum dapat dikonversikan ke Order Penjualan.`, 'warning');
}

async function approveQuotationByRole(quotationId, approverRole) {
  const quo = (state.quotations || []).find(q => q.id === quotationId);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }

  if (isQuotationDraft(quo)) {
    showToast(`📝 Quotation #${quotationId} masih berstatus Draft dan belum diterbitkan ke Ketua UBM / Direktur! Klik tombol Terbitkan terlebih dahulu.`, 'warning');
    return;
  }

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : (typeof getLoggedInUser === 'function' ? getLoggedInUser() : null);
  const currentRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || '');
  const isAdmin = currentRole === 'Administrator';
  const isKetuaUbm = currentRole === 'Ketua UBM';
  const isDirektur = currentRole === 'Direktur' || (currentRole.toLowerCase().includes('direktur') && !currentRole.toLowerCase().includes('wakil'));

  if (approverRole === 'Ketua UBM') {
    if (!isAdmin && !isKetuaUbm) {
      showToast('⚠️ Hanya Ketua UBM atau Administrator yang dapat memberikan persetujuan ini.', 'warning');
      return;
    }
  } else if (approverRole === 'Direktur') {
    if (!isAdmin && !isDirektur) {
      showToast('⚠️ Hanya Direktur atau Administrator yang dapat memberikan persetujuan ini.', 'warning');
      return;
    }
  }

  if (approverRole === 'Ketua UBM' && quo.approvalKetuaUbm) {
    showToast('Persetujuan Ketua UBM sudah disetujui secara permanen.', 'info');
    return;
  }
  if (approverRole === 'Direktur' && quo.approvalDirektur) {
    showToast('Persetujuan Direktur sudah disetujui secara permanen.', 'info');
    return;
  }

  const approverName = activeUser?.name || approverRole;
  const nowIso = new Date().toISOString();

  quo.isDraft = false;
  if (approverRole === 'Ketua UBM') {
    quo.approvalKetuaUbm = true;
    quo.approvalKetuaUbmBy = approverName;
    quo.approvalKetuaUbmDate = nowIso;
  } else if (approverRole === 'Direktur') {
    quo.approvalDirektur = true;
    quo.approvalDirekturBy = approverName;
    quo.approvalDirekturDate = nowIso;
  }

  const isDualApproved = Boolean(quo.approvalKetuaUbm && quo.approvalDirektur);
  if (isDualApproved) {
    quo.status = 'Accepted';
  } else if (quo.status === 'Rejected') {
    quo.status = 'Sent';
  }

  if (typeof embedQuotationApprovalInNotes === 'function') {
    const targetNotes = quo._rawNotes || quo.notes || '';
    const embedded = embedQuotationApprovalInNotes(targetNotes, quo);
    quo._rawNotes = embedded;
    quo.notes = embedded;
  }

  // Update UI optimistik
  renderQuotationsTable();

  const saveRes = await persistQuotationRecord(quo, true);
  if (saveRes.ok) {
    const savedQuo = saveRes.data;
    if (savedQuo && typeof savedQuo === 'object') {
      if (quo.approvalKetuaUbm) {
        savedQuo.approvalKetuaUbm = true;
        savedQuo.approvalKetuaUbmBy = quo.approvalKetuaUbmBy;
        savedQuo.approvalKetuaUbmDate = quo.approvalKetuaUbmDate;
      }
      if (quo.approvalDirektur) {
        savedQuo.approvalDirektur = true;
        savedQuo.approvalDirekturBy = quo.approvalDirekturBy;
        savedQuo.approvalDirekturDate = quo.approvalDirekturDate;
      }
      if (isDualApproved) savedQuo.status = 'Accepted';
      savedQuo.isDraft = false;
      const idx = (state.quotations || []).findIndex(q => q.id === quotationId);
      if (idx !== -1) state.quotations[idx] = savedQuo;
    }

    if (isDualApproved) {
      showToast(`✅ Quotation #${quotationId} telah disetujui lengkap oleh Ketua UBM & Direktur! Siap dikonversikan ke Order Penjualan.`, 'success');
    } else {
      showToast(`✅ Persetujuan ${approverRole} untuk Quotation #${quotationId} berhasil disimpan ke Supabase!`, 'success');
    }
  } else {
    showToast(`Persetujuan tersimpan di sesi lokal (${saveRes.error})`, 'info');
  }

  renderQuotationsTable();
  if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
}

async function rejectQuotationByRole(quotationId, rejectorRole) {
  const quo = (state.quotations || []).find(q => q.id === quotationId);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }

  if (isQuotationDraft(quo)) {
    showToast(`📝 Quotation #${quotationId} masih berstatus Draft (belum diajukan ke pimpinan).`, 'warning');
    return;
  }

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : (typeof getLoggedInUser === 'function' ? getLoggedInUser() : null);
  const currentRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || '');
  const isAdmin = currentRole === 'Administrator';
  const isKetuaUbm = currentRole === 'Ketua UBM';
  const isDirektur = currentRole === 'Direktur' || (currentRole.toLowerCase().includes('direktur') && !currentRole.toLowerCase().includes('wakil'));

  if (rejectorRole === 'Ketua UBM' && !isAdmin && !isKetuaUbm) {
    showToast('⚠️ Hanya Ketua UBM atau Administrator yang dapat menolak pada kolom Ketua UBM.', 'warning');
    return;
  } else if (rejectorRole === 'Direktur' && !isAdmin && !isDirektur) {
    showToast('⚠️ Hanya Direktur atau Administrator yang dapat menolak pada kolom Direktur.', 'warning');
    return;
  }

  const reason = prompt(`Tolak Surat Penawaran #${quotationId} sebagai ${rejectorRole}?\n\nMasukkan catatan / alasan penolakan (opsional):`, '');
  if (reason === null) {
    return;
  }

  const rejectorName = activeUser?.name || rejectorRole;
  const nowIso = new Date().toISOString();
  if (rejectorRole === 'Ketua UBM') {
    quo.approvalKetuaUbm = false;
    quo.approvalKetuaUbmBy = `Ditolak oleh ${rejectorName}`;
    quo.approvalKetuaUbmDate = nowIso;
  } else if (rejectorRole === 'Direktur') {
    quo.approvalDirektur = false;
    quo.approvalDirekturBy = `Ditolak oleh ${rejectorName}`;
    quo.approvalDirekturDate = nowIso;
  }

  quo.status = 'Rejected';
  quo.isDraft = false;
  if (reason.trim()) {
    quo.rejectionNotes = `[${rejectorRole} - ${rejectorName}]: ${reason.trim()}`;
  }

  if (typeof embedQuotationApprovalInNotes === 'function') {
    const targetNotes = quo._rawNotes || quo.notes || '';
    const embedded = embedQuotationApprovalInNotes(targetNotes, quo);
    quo._rawNotes = embedded;
    quo.notes = embedded;
  }

  renderQuotationsTable();

  const saveRes = await persistQuotationRecord(quo, true);
  if (saveRes.ok) {
    showToast(`Surat Penawaran #${quotationId} telah ditolak oleh ${rejectorRole}.`, 'warning');
  } else {
    showToast(`Status penolakan tersimpan di sesi lokal (${saveRes.error})`, 'info');
  }

  renderQuotationsTable();
  if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
}

function renderQuotationsTable() {
  const tbody = document.getElementById('table-quotations-body');
  if (!tbody) return;

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : (typeof getLoggedInUser === 'function' ? getLoggedInUser() : null);
  const currentRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || '');
  const isAdmin = currentRole === 'Administrator';
  const isPPIC = currentRole === 'PPIC';
  const isKetuaUbm = currentRole === 'Ketua UBM';
  const isDirektur = currentRole === 'Direktur' || (currentRole.toLowerCase().includes('direktur') && !currentRole.toLowerCase().includes('wakil'));

  const createQuoBtn = document.getElementById('btn-quotation-create');
  if (createQuoBtn) {
    createQuoBtn.style.display = isPPIC ? 'none' : 'inline-flex';
  }

  const statusFilter = document.getElementById('filter-quotation-status')?.value || 'ALL';
  let list = (state.quotations || []).filter(q => isQuotationVisibleToUser(q, activeUser));

  if (statusFilter !== 'ALL') {
    if (statusFilter === 'Draft') {
      list = list.filter(q => isQuotationDraft(q));
    } else {
      list = list.filter(q => q.status === statusFilter && !(statusFilter !== 'Draft' && isQuotationDraft(q)));
    }
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(item =>
      (item.id || '').toLowerCase().includes(q) ||
      (item.customerName || '').toLowerCase().includes(q) ||
      (item.projectName || '').toLowerCase().includes(q) ||
      (item.picName || '').toLowerCase().includes(q) ||
      (item.customerPhone || '').toLowerCase().includes(q) ||
      (Array.isArray(item.items) && item.items.some(it => (it.itemName || '').toLowerCase().includes(q)))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted" style="padding: 28px;">Tidak ada data quotation penawaran harga ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(quo => {
    if (typeof ensureQuotationApprovalData === 'function') {
      ensureQuotationApprovalData(quo);
    }

    const isDraft = isQuotationDraft(quo);
    const isRejected = quo.status === 'Rejected';
    const isJasa = quo.quotationType === 'jasa';
    const itemCount = Array.isArray(quo.items) ? quo.items.length : 0;
    const phone = quo.customerPhone || '';
    const rawWarranty = quo.warranty || (quo.items && quo.items.find(i => i.warranty)?.warranty) || (isJasa ? 'Garansi Pengerjaan' : 'Garansi Standar');
    const isNoWarranty = !isJasa && (
      rawWarranty === '0' ||
      rawWarranty === '0 Bulan' ||
      rawWarranty.toLowerCase() === 'tidak ada garansi' ||
      rawWarranty === '-' ||
      (quo.warrantyFee === 0 && quo.items && quo.items.every(i => !i.warranty || i.warranty === '0' || i.warranty === '0 Bulan' || String(i.warranty).toLowerCase() === 'tidak ada garansi'))
    );
    const warrantyText = isNoWarranty ? 'Tidak Ada Garansi' : rawWarranty;
    const isExpired = !isDraft && quo.validUntil && new Date(quo.validUntil) < new Date(new Date().toDateString());

    const isAccepted = quo.status === 'Accepted';
    const isPengajuan = quo.status === 'Pengajuan';
    const existingOrder = (state.orders || []).find(o => o.quotationId === quo.id || (o.notes && o.notes.includes(quo.id)));
    const isConverted = !!existingOrder;

    // Dual Approval Verification (Draft tidak pernah dianggap approved)
    const isKetuaApproved = !isDraft && Boolean(quo.approvalKetuaUbm);
    const isDirekturApproved = !isDraft && Boolean(quo.approvalDirektur);
    const isDualApproved = !isDraft && Boolean(isKetuaApproved && isDirekturApproved);

    const isKetuaRejected = isRejected && String(quo.approvalKetuaUbmBy || '').startsWith('Ditolak');
    const isDirekturRejected = isRejected && String(quo.approvalDirekturBy || '').startsWith('Ditolak');

    // 1. Kolom Persetujuan Ketua UBM
    let statusKetuaHtml = '';
    if (isDraft) {
      statusKetuaHtml = `
        <span class="badge" style="font-size: 8.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #64748b; border: 1px dashed #cbd5e1; display: inline-flex; align-items: center; gap: 3px;" title="Masih berstatus Draft — belum dikirim ke Ketua UBM untuk approval">
          <i data-lucide="file-clock" style="width: 9px; height: 9px;"></i> Draft (Belum Terbit)
        </span>
      `;
    } else if (isKetuaApproved) {
      statusKetuaHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
          <span class="badge" style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 3px;" title="Disetujui oleh: ${escapeAttr(quo.approvalKetuaUbmBy || 'Ketua UBM')}">
            <i data-lucide="check-circle" style="width: 10px; height: 10px; color: #10b981;"></i> Disetujui
          </span>
          <span style="font-size: 8px; color: #047857; font-weight: 600; line-height: 1.1; max-width: 95px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(quo.approvalKetuaUbmBy || 'Ketua UBM')}
          </span>
        </div>
      `;
    } else if (isKetuaRejected) {
      statusKetuaHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
          <span class="badge" style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; display: inline-flex; align-items: center; gap: 3px;" title="${escapeAttr(quo.approvalKetuaUbmBy || 'Ditolak Ketua UBM')}">
            <i data-lucide="x-circle" style="width: 10px; height: 10px; color: #ef4444;"></i> Ditolak
          </span>
          <span style="font-size: 8px; color: #b91c1c; font-weight: 600; line-height: 1.1; max-width: 95px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(quo.approvalKetuaUbmBy || 'Ketua UBM')}
          </span>
        </div>
      `;
    } else if (isRejected) {
      statusKetuaHtml = `
        <span class="badge" style="font-size: 8.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;">
          Perlu Revisi
        </span>
      `;
    } else {
      if (isAdmin || isKetuaUbm) {
        statusKetuaHtml = `
          <div style="display: flex; gap: 3px; justify-content: center; align-items: center; flex-wrap: nowrap;">
            <button type="button" class="btn btn-xs" style="background: #16a34a; color: #ffffff; border: none; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); approveQuotationByRole('${quo.id}', 'Ketua UBM')" title="Setujui penawaran ini sebagai Ketua UBM">
              <i data-lucide="check" style="width: 9px; height: 9px;"></i> Setuju
            </button>
            <button type="button" class="btn btn-xs" style="background: #ef4444; color: #ffffff; border: none; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); rejectQuotationByRole('${quo.id}', 'Ketua UBM')" title="Tolak penawaran ini">
              <i data-lucide="x" style="width: 9px; height: 9px;"></i> Tidak
            </button>
          </div>
        `;
      } else {
        statusKetuaHtml = `
          <span class="badge" style="font-size: 8.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 2px;" title="Menunggu persetujuan Ketua UBM">
            <i data-lucide="clock" style="width: 8px; height: 8px;"></i> Menunggu
          </span>
        `;
      }
    }

    // 2. Kolom Persetujuan Direktur
    let statusDirekturHtml = '';
    if (isDraft) {
      statusDirekturHtml = `
        <span class="badge" style="font-size: 8.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #64748b; border: 1px dashed #cbd5e1; display: inline-flex; align-items: center; gap: 3px;" title="Masih berstatus Draft — belum dikirim ke Direktur untuk approval">
          <i data-lucide="file-clock" style="width: 9px; height: 9px;"></i> Draft (Belum Terbit)
        </span>
      `;
    } else if (isDirekturApproved) {
      statusDirekturHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
          <span class="badge" style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 3px;" title="Disetujui oleh: ${escapeAttr(quo.approvalDirekturBy || 'Direktur')}">
            <i data-lucide="check-circle" style="width: 10px; height: 10px; color: #10b981;"></i> Disetujui
          </span>
          <span style="font-size: 8px; color: #047857; font-weight: 600; line-height: 1.1; max-width: 95px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(quo.approvalDirekturBy || 'Direktur')}
          </span>
        </div>
      `;
    } else if (isDirekturRejected) {
      statusDirekturHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
          <span class="badge" style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; display: inline-flex; align-items: center; gap: 3px;" title="${escapeAttr(quo.approvalDirekturBy || 'Ditolak Direktur')}">
            <i data-lucide="x-circle" style="width: 10px; height: 10px; color: #ef4444;"></i> Ditolak
          </span>
          <span style="font-size: 8px; color: #b91c1c; font-weight: 600; line-height: 1.1; max-width: 95px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(quo.approvalDirekturBy || 'Direktur')}
          </span>
        </div>
      `;
    } else if (isRejected) {
      statusDirekturHtml = `
        <span class="badge" style="font-size: 8.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;">
          Perlu Revisi
        </span>
      `;
    } else {
      if (isAdmin || isDirektur) {
        statusDirekturHtml = `
          <div style="display: flex; gap: 3px; justify-content: center; align-items: center; flex-wrap: nowrap;">
            <button type="button" class="btn btn-xs" style="background: #0284c7; color: #ffffff; border: none; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); approveQuotationByRole('${quo.id}', 'Direktur')" title="Setujui penawaran ini sebagai Direktur">
              <i data-lucide="check" style="width: 9px; height: 9px;"></i> Setuju
            </button>
            <button type="button" class="btn btn-xs" style="background: #ef4444; color: #ffffff; border: none; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px; cursor: pointer; white-space: nowrap;" onclick="event.stopPropagation(); rejectQuotationByRole('${quo.id}', 'Direktur')" title="Tolak penawaran ini">
              <i data-lucide="x" style="width: 9px; height: 9px;"></i> Tidak
            </button>
          </div>
        `;
      } else {
        statusDirekturHtml = `
          <span class="badge" style="font-size: 8.5px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 2px;" title="Menunggu persetujuan Direktur">
            <i data-lucide="clock" style="width: 8px; height: 8px;"></i> Menunggu
          </span>
        `;
      }
    }

    const rowBgStyle = isDraft
      ? 'background-color: #f8fafc;'
      : (isAccepted ? 'background-color: #f0fdf4;' : (isPengajuan ? 'background-color: #fffbeb;' : (isRejected ? 'background-color: #fef2f2;' : '')));

    const statusMiniBadge = isDraft
      ? '<span class="badge" style="font-size: 8.5px; padding: 1.5px 5px; background: #e2e8f0; color: #334155; font-weight: 700;">📝 Draft</span>'
      : (isRejected
        ? '<span class="badge" style="font-size: 8.5px; padding: 1.5px 5px; background: #fee2e2; color: #b91c1c; font-weight: 700;">❌ Ditolak</span>'
        : (isAccepted
          ? '<span class="badge" style="font-size: 8.5px; padding: 1.5px 5px; background: #dcfce7; color: #166534; font-weight: 700;">✅ Accepted</span>'
          : (isPengajuan
            ? '<span class="badge" style="font-size: 8.5px; padding: 1.5px 5px; background: #fef3c7; color: #b45309; font-weight: 700;">🟡 Pengajuan</span>'
            : '<span class="badge" style="font-size: 8.5px; padding: 1.5px 5px; background: #e0f2fe; color: #0369a1; font-weight: 700;">✉️ Terbit</span>')));

    const customerDisplay = quo.customerName
      ? `<div class="font-bold text-main" style="word-break: break-word;">${escapeHtml(quo.customerName)}</div>`
      : `<div class="text-muted" style="font-style: italic; font-size: 11px;">(Calon Customer Belum Diisi)</div>`;

    return `
      <tr class="${isDraft ? 'row-draft' : (isAccepted ? 'row-accepted' : (isPengajuan ? 'row-pengajuan' : ''))}" style="${rowBgStyle} cursor: pointer;" onclick="if (!event.target.closest('.table-actions, button, a, input, select, textarea')) viewQuotationDetail('${quo.id}')" title="Klik untuk melihat rincian surat penawaran ${quo.id}">
        <td style="font-size: 11px; padding: 8px 6px;">
          <span class="mono-id font-bold text-primary" style="font-size: 11px; padding: 2px 4px; word-break: break-all;">${quo.id}</span>
          <div style="margin-top: 3px; display: flex; flex-wrap: wrap; gap: 3px;">
            <span class="badge ${isJasa ? 'badge-info' : 'badge-outline'}" style="font-size: 9px; padding: 1.5px 5px; font-weight: 700;">
              ${isJasa ? '🛠️ Jasa' : '📦 Produk'}
            </span>
            ${statusMiniBadge}
          </div>
        </td>
        <td>
          ${customerDisplay}
          ${quo.projectName ? `<div class="text-primary font-bold" style="font-size: 11px; margin-top: 1px;"><i data-lucide="folder-kanban" style="width: 11px; height: 11px; display: inline; vertical-align: middle; color: #4f46e5;"></i> ${escapeHtml(quo.projectName)}</div>` : ''}
          ${quo.picName ? `<div class="text-muted font-sm" style="font-size: 10px;">UP: ${escapeHtml(quo.picName)}</div>` : ''}
          ${isRejected && quo.rejectionNotes ? `<div style="font-size: 9.5px; color: #b91c1c; margin-top: 2px; line-height: 1.2;">${escapeHtml(quo.rejectionNotes)}</div>` : ''}
        </td>
        <td>
          <div style="display: inline-flex; align-items: center; gap: 5px; flex-wrap: wrap;">
            <span class="font-mono font-sm" style="font-size: 11.5px;">${phone || '-'}</span>
            ${phone && !isDraft && !isPPIC ? `
              <button type="button" class="btn-icon" style="color: #25d366; padding: 0; width: 22px; height: 22px;" title="Share WhatsApp (Format PDF)" onclick="event.stopPropagation(); shareQuotationWhatsApp('${quo.id}')">
                <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
              </button>
            ` : ''}
          </div>
        </td>
        <td style="font-size: 11.5px;">${quo.quotationDate || '-'}</td>
        <td style="font-size: 11.5px;">
          <span style="${isExpired ? 'color: #e11d48; font-weight: 600;' : ''}">${quo.validUntil || '-'}</span>
          ${isExpired ? '<br><span class="badge badge-danger" style="font-size: 9.5px; padding: 1px 4px; margin-top: 2px;">Expired</span>' : ''}
        </td>
        <td>
          <div style="font-size: 11px; line-height: 1.35; word-break: break-word;" title="${escapeAttr(warrantyText)}">
            <span class="badge badge-outline" style="font-size: 10px; border-color: #cbd5e1; white-space: normal; text-align: left; padding: 2px 6px;">
              <i data-lucide="shield-check" style="width: 11px; height: 11px; color: #10b981; display: inline; vertical-align: middle; flex-shrink: 0;"></i> ${escapeHtml(warrantyText)}
            </span>
          </div>
        </td>
        <td style="text-align: center;"><span class="badge badge-secondary font-bold" style="font-size: 10.5px;">${itemCount} Item</span></td>
        <td class="font-bold font-mono text-main" style="font-size: 12px; word-break: break-word; text-align: right;">${formatRupiah(quo.grandTotal)}</td>
        <td style="text-align: center;">${statusKetuaHtml}</td>
        <td style="text-align: center;">${statusDirekturHtml}</td>
        <td class="text-right" style="padding-right: 8px;">
          <div class="table-actions" style="display: flex; flex-wrap: wrap; gap: 3px; justify-content: flex-end; align-items: center; width: 100%;">
            ${isPPIC ? `
              <button class="btn-icon" style="color: #0284c7; width: 25px; height: 25px; border-radius: 4px;" title="Lihat Detail Dokumen Quotation" onclick="event.stopPropagation(); viewQuotationDetail('${quo.id}')">
                <i data-lucide="eye" style="width: 13px; height: 13px;"></i>
              </button>
            ` : `
              ${isDraft ? `
                <button class="btn-icon" style="color: #94a3b8; opacity: 0.35; cursor: not-allowed; width: 25px; height: 25px; border-radius: 4px;" title="Quotation Draft tidak dapat dicetak. Terbitkan terlebih dahulu." onclick="event.stopPropagation(); showToast('📝 Quotation masih berstatus Draft sehingga belum dapat dicetak. Klik Terbitkan terlebih dahulu!', 'warning')">
                  <i data-lucide="printer" style="width: 13px; height: 13px;"></i>
                </button>
                <button class="btn-icon" style="color: #0284c7; width: 25px; height: 25px; border-radius: 4px;" title="Lihat Pratinjau Draft" onclick="event.stopPropagation(); viewQuotationDetail('${quo.id}')">
                  <i data-lucide="eye" style="width: 13px; height: 13px;"></i>
                </button>
                <button class="btn-icon" style="color: #ffffff; background: #16a34a; width: 25px; height: 25px; border-radius: 4px;" title="Simpan & Terbitkan Draft ke Ketua UBM & Direktur" onclick="event.stopPropagation(); publishDraftQuotation('${quo.id}')">
                  <i data-lucide="send" style="width: 12px; height: 12px;"></i>
                </button>
                <button class="btn-icon" style="width: 25px; height: 25px; border-radius: 4px;" title="Edit Draft Quotation" onclick="event.stopPropagation(); editQuotation('${quo.id}')">
                  <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i>
                </button>
                <button class="btn-icon" style="width: 25px; height: 25px; border-radius: 4px; color: #94a3b8; background: #f8fafc; cursor: not-allowed; border: 1px solid #e2e8f0;" title="Masih berstatus Draft: Terbitkan & lengkapi persetujuan terlebih dahulu" onclick="event.stopPropagation(); promptQuotationDualApprovalRequired('${quo.id}')">
                  <i data-lucide="lock" style="width: 13px; height: 13px; color: #94a3b8;"></i>
                </button>
              ` : `
                <button class="btn-icon" style="color: #4338ca; width: 25px; height: 25px; border-radius: 4px;" title="Cetak / Simpan PDF Surat Penawaran" onclick="event.stopPropagation(); printQuotationPDF('${quo.id}')">
                  <i data-lucide="printer" style="width: 13px; height: 13px;"></i>
                </button>
                <button class="btn-icon" style="color: #0284c7; width: 25px; height: 25px; border-radius: 4px;" title="Pratinjau Dokumen Quotation" onclick="event.stopPropagation(); viewQuotationDetail('${quo.id}')">
                  <i data-lucide="eye" style="width: 13px; height: 13px;"></i>
                </button>
                <button class="btn-icon" style="color: #16a34a; width: 25px; height: 25px; border-radius: 4px;" title="Share WhatsApp (Format PDF)" onclick="event.stopPropagation(); shareQuotationWhatsApp('${quo.id}')">
                  <i data-lucide="share-2" style="width: 13px; height: 13px;"></i>
                </button>
                ${isConverted ? `
                  <button class="btn-icon" style="color: #10b981; background: #ecfdf5; border: 1px solid #a7f3d0; width: 25px; height: 25px; border-radius: 4px; cursor: default;" title="Sudah Dikonversi ke Order Penjualan #${existingOrder.id}" onclick="event.stopPropagation(); showToast('Surat Penawaran ini sudah dikonversi ke Order Penjualan #${existingOrder.id}', 'info')">
                    <i data-lucide="check-check" style="width: 13px; height: 13px;"></i>
                  </button>
                  <button class="btn-icon" style="width: 25px; height: 25px; border-radius: 4px; color: #94a3b8; background: #f8fafc; cursor: not-allowed; border: 1px solid #e2e8f0;" title="Quotation Terkunci (Sudah Dikonversi ke Order Penjualan #${existingOrder.id})" onclick="event.stopPropagation(); showToast('Surat Penawaran #${quo.id} terkunci dan tidak dapat diedit karena sudah dikonversi ke Order Penjualan #${existingOrder.id}!', 'warning')">
                    <i data-lucide="lock" style="width: 13px; height: 13px; color: #94a3b8;"></i>
                  </button>
                ` : (isDualApproved ? `
                  <button class="btn-icon" style="color: #4f46e5; width: 25px; height: 25px; border-radius: 4px;" title="Konversi ke Order Penjualan (Telah Disetujui Lengkap)" onclick="event.stopPropagation(); convertQuotationToOrder('${quo.id}')">
                    <i data-lucide="arrow-right-circle" style="width: 13px; height: 13px;"></i>
                  </button>
                  <button class="btn-icon" style="width: 25px; height: 25px; border-radius: 4px;" title="Edit Quotation" onclick="event.stopPropagation(); editQuotation('${quo.id}')">
                    <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i>
                  </button>
                ` : `
                  <button class="btn-icon" style="width: 25px; height: 25px; border-radius: 4px; color: #94a3b8; background: #f8fafc; cursor: not-allowed; border: 1px solid #e2e8f0;" title="Konversi Terkunci: Menunggu persetujuan Ketua UBM dan Direktur" onclick="event.stopPropagation(); promptQuotationDualApprovalRequired('${quo.id}')">
                    <i data-lucide="lock" style="width: 13px; height: 13px; color: #94a3b8;"></i>
                  </button>
                  <button class="btn-icon" style="width: 25px; height: 25px; border-radius: 4px;" title="Edit Quotation" onclick="event.stopPropagation(); editQuotation('${quo.id}')">
                    <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i>
                  </button>
                `)}
              `}
              <button class="btn-icon btn-danger-ghost" style="width: 25px; height: 25px; border-radius: 4px;" title="${isConverted ? 'Quotation sudah dikonversi ke order' : 'Hapus Quotation'}" onclick="event.stopPropagation(); ${isConverted ? `showToast('Surat Penawaran #${quo.id} tidak dapat dihapus karena sudah dikonversikan ke Order Penjualan #${existingOrder.id}!', 'warning')` : `deleteResource('quotations', '${quo.id}')`}">
                <i data-lucide="trash-2" style="width: 13px; height: 13px; ${isConverted ? 'opacity: 0.4;' : ''}"></i>
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterQuotations() {
  renderQuotationsTable();
}

// -------------------------------------------------------------
// TOGGLE TIPE PENAWARAN (PRODUK MANUFAKTUR vs JASA)
// -------------------------------------------------------------
function toggleQuotationTypeUI(type) {
  const isJasa = type === 'jasa';
  
  // Update toggle styling
  const optProduk = document.getElementById('quo-opt-produk-label');
  const optJasa = document.getElementById('quo-opt-jasa-label');
  if (optProduk && optJasa) {
    if (isJasa) {
      optProduk.style.borderColor = '#cbd5e1';
      optProduk.style.background = '#f8fafc';
      optProduk.style.color = '#64748b';
      optProduk.style.fontWeight = '500';

      optJasa.style.borderColor = '#10b981';
      optJasa.style.background = '#ecfdf5';
      optJasa.style.color = '#047857';
      optJasa.style.fontWeight = '700';
    } else {
      optProduk.style.borderColor = '#3b82f6';
      optProduk.style.background = '#eff6ff';
      optProduk.style.color = '#1d4ed8';
      optProduk.style.fontWeight = '700';

      optJasa.style.borderColor = '#cbd5e1';
      optJasa.style.background = '#f8fafc';
      optJasa.style.color = '#64748b';
      optJasa.style.fontWeight = '500';
    }
  }

  // Update Section 1 title & descriptions
  const titleEl = document.getElementById('quo-section-1-title');
  const descEl = document.getElementById('quo-section-1-desc');
  const addBtnText = document.getElementById('quo-btn-add-item-text');
  const colName = document.getElementById('quo-col-item-name');
  const colSku = document.getElementById('quo-col-item-sku');
  const colPrice = document.getElementById('quo-col-item-price');
  const subTotalLabel = document.getElementById('quo-label-main-items-total');

  if (isJasa) {
    if (titleEl) titleEl.innerHTML = '<i data-lucide="wrench" style="width: 16px; height: 16px; color: #10b981;"></i> 1. Rincian Penawaran Jasa & Layanan Pekerjaan (Non-BOM)';
    if (descEl) descEl.textContent = 'Rincian pekerjaan/jasa yang akan langsung diproses ke Penugasan Tim & Project Management (Tanpa formulasi BOM).';
    if (addBtnText) addBtnText.textContent = 'Tambah Baris Jasa/Pekerjaan';
    if (colName) colName.textContent = 'Nama Jasa / Uraian Pekerjaan *';
    if (colSku) colSku.textContent = 'Kode Jasa';
    if (colPrice) colPrice.textContent = 'Tarif / Biaya (Rp) *';
    if (subTotalLabel) subTotalLabel.textContent = 'Total Biaya Jasa Utama:';
  } else {
    if (titleEl) titleEl.innerHTML = '<i data-lucide="package" style="width: 16px; height: 16px; color: #10b981;"></i> 1. Rincian Penawaran Harga Produk Utama';
    if (descEl) descEl.textContent = 'Barang/produk utama yang akan diproses ke Order Penjualan, formulasi BOM, & Purchasing';
    if (addBtnText) addBtnText.textContent = 'Tambah Baris Produk';
    if (colName) colName.textContent = 'Nama Produk / Deskripsi Item *';
    if (colSku) colSku.textContent = 'Kode / SKU';
    if (colPrice) colPrice.textContent = 'Harga Satuan (Rp) *';
    if (subTotalLabel) subTotalLabel.textContent = 'Total Produk Utama:';
  }

  // Update Header Columns for Items (Sembunyikan Garansi & Satuan jika Jasa)
  const itemsHeader = document.getElementById('quo-items-header');
  const colWarranty = document.getElementById('quo-col-item-warranty');
  const colUnit = document.getElementById('quo-col-item-unit');

  if (itemsHeader) {
    itemsHeader.style.gridTemplateColumns = isJasa
      ? 'minmax(0, 3fr) minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px'
      : 'minmax(0, 2.4fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px';
  }
  if (colWarranty) colWarranty.style.display = isJasa ? 'none' : 'block';
  if (colUnit) colUnit.style.display = isJasa ? 'none' : 'block';

  // Update existing item rows (Sembunyikan cell Garansi & Satuan jika Jasa)
  document.querySelectorAll('.quotation-item-row').forEach(row => {
    row.style.gridTemplateColumns = isJasa
      ? 'minmax(0, 3fr) minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px'
      : 'minmax(0, 2.4fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px';

    const cellWarranty = row.querySelector('.quo-cell-warranty');
    const cellUnit = row.querySelector('.quo-cell-unit');
    if (cellWarranty) cellWarranty.style.display = isJasa ? 'none' : 'block';
    if (cellUnit) cellUnit.style.display = isJasa ? 'none' : 'block';

    const nameInput = row.querySelector('.item-name');
    const skuInput = row.querySelector('.item-sku');
    if (nameInput) nameInput.placeholder = isJasa ? 'Uraian pekerjaan / layanan jasa' : 'Nama produk penawaran';
    if (skuInput) {
      skuInput.placeholder = isJasa ? 'KODE-JASA (Otomatis)' : 'SKU Otomatis';
      const curSku = (skuInput.value || '').trim();
      if (!curSku) {
        skuInput.value = generateUniqueQuotationSku(isJasa ? 'JASA' : 'SKU');
      } else if (/^(SKU|JASA)-\d{6}-[A-Z0-9]+$/i.test(curSku)) {
        const nextPrefix = isJasa ? 'JASA' : 'SKU';
        const replaced = curSku.replace(/^(SKU|JASA)-/i, `${nextPrefix}-`);
        skuInput.value = replaced;
      }
    }
  });

  // Update CARD 3: Klausul Garansi Produk (Sembunyikan untuk Jasa)
  const card3Grid = document.getElementById('quo-card3-grid');
  const warrantyClauseGroup = document.getElementById('quo-warranty-clause-group');
  if (card3Grid) {
    card3Grid.style.gridTemplateColumns = isJasa ? '1fr 1.2fr' : '1.2fr 1fr 1.2fr';
  }
  if (warrantyClauseGroup) {
    warrantyClauseGroup.style.display = isJasa ? 'none' : 'block';
  }

  // Update CARD 4: Biaya Garansi 5% (Sembunyikan untuk Jasa)
  const warrantyFeeRow = document.getElementById('quo-warranty-fee-row');
  const subtotalLabel = document.getElementById('quo-subtotal-label');
  if (warrantyFeeRow) {
    warrantyFeeRow.style.display = isJasa ? 'none' : 'flex';
  }
  if (subtotalLabel) {
    subtotalLabel.textContent = isJasa ? 'Subtotal:' : 'Subtotal (Item + Garansi):';
  }

  // Kalkulasi ulang total keuangan penawaran (Jasa tidak mengenakan biaya garansi)
  calculateQuotationTotals();

  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// FORMULIR QUOTATION (MODAL CREATE & EDIT)
// -------------------------------------------------------------
function openQuotationModal(quotationData = null) {
  if (isQuotationReadOnlyForUser()) {
    showToast('⚠️ Role PPIC hanya memiliki akses melihat pada halaman Quotation.', 'warning');
    return;
  }
  if (quotationData && isQuotationDraft(quotationData) && !isQuotationVisibleToUser(quotationData)) {
    showToast('🔒 Draft Quotation ini hanya dapat diakses oleh pembuat draft atau Administrator.', 'warning');
    return;
  }
  if (quotationData && quotationData.id) {
    const existingOrder = (state.orders || []).find(o => o.quotationId === quotationData.id || (o.notes && o.notes.includes(quotationData.id)));
    if (existingOrder) {
      showToast(`⚠️ Surat Penawaran #${quotationData.id} tidak dapat diedit karena sudah dikonversikan ke Order Penjualan #${existingOrder.id}!`, 'warning');
      return;
    }
  }

  const isEdit = !!quotationData;
  const isJasa = quotationData?.quotationType === 'jasa';
  const isDraft = isEdit && isQuotationDraft(quotationData);
  const isRejected = isEdit && quotationData?.status === 'Rejected';
  const hasAnyApproval = isEdit && Boolean(quotationData?.approvalKetuaUbm || quotationData?.approvalDirektur);
  const canSaveAsDraft = !isEdit || isDraft || isRejected || (quotationData?.status === 'Sent' && !hasAnyApproval);

  const custVal = (quotationData?.customerName && quotationData.customerName !== 'Calon Pelanggan (Ditulis Tangan)')
    ? quotationData.customerName
    : '';
  const defaultNoteText = '1. Harga sudah termasuk biaya instalasi dan pengetesan fungsi di lokasi.\n2. Penawaran harga ini mengikat selama masa berlaku penawaran.';
  const cleanNotesVal = isEdit ? getQuotationDisplayNotes(quotationData?.notes || '') : defaultNoteText;

  document.getElementById('form-modal-title').innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px;">
      <i data-lucide="${isEdit ? 'edit-3' : 'file-plus'}" style="color: #2563eb;"></i>
      ${isEdit ? `Edit ${isDraft ? 'Draft Penawaran' : 'Surat Penawaran'}: <span class="mono-id">${quotationData.id}</span>` : 'Buat Surat Penawaran Harga (Quotation) Baru'}
    </span>
  `;
  
  const modalContainer = document.querySelector('#form-modal .modal-container');
  if (modalContainer) {
    modalContainer.style.maxWidth = '1020px';
    modalContainer.style.width = '94vw';
  }

  const today = new Date().toISOString().split('T')[0];
  const defaultValidDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const statusColor = isDraft
    ? '#475569'
    : (isRejected
      ? '#dc2626'
      : (quotationData?.status === 'Accepted'
        ? '#16a34a'
        : (quotationData?.status === 'Pengajuan' ? '#b45309' : '#0284c7')));
  const statusIcon = isDraft
    ? 'file-clock'
    : (isRejected
      ? 'x-circle'
      : (quotationData?.status === 'Accepted'
        ? 'check-circle-2'
        : (quotationData?.status === 'Pengajuan' ? 'clock' : 'send')));
  const statusLabel = isDraft
    ? '📝 Draft (Belum Terbit — Tidak Terkirim ke Pimpinan)'
    : (isRejected
      ? '❌ Rejected (Ditolak — Perlu Revisi & Terbit Ulang)'
      : (quotationData?.status === 'Accepted'
        ? '✅ Accepted (Disetujui Lengkap)'
        : (quotationData?.status === 'Pengajuan'
          ? '🟡 Pengajuan (Dikonversi ke Order Penjualan)'
          : '✉️ Sent (Dikirim ke Ketua UBM & Direktur saat Terbit)')));

  const formBody = document.getElementById('form-modal-body');
  formBody.innerHTML = `
    <form id="quotation-form" onsubmit="submitQuotation(event, '${isEdit ? quotationData.id : ''}', 'publish')" style="display: flex; flex-direction: column; gap: 20px;">
      
      ${isDraft ? `
        <div style="background: #f1f5f9; border: 1px dashed #64748b; border-radius: 8px; padding: 11px 16px; display: flex; align-items: flex-start; gap: 10px; font-size: 12px; color: #334155;">
          <i data-lucide="file-clock" style="width: 18px; height: 18px; color: #475569; flex-shrink: 0; margin-top: 1px;"></i>
          <div>
            <strong>Mode Draft Penawaran (Supabase Draft):</strong> Data ini tersimpan sebagai <strong>Draft</strong> dan <strong>tidak dikirimkan ke Ketua UBM maupun Direktur</strong> untuk approval. Jika penawaran sudah siap, klik <strong>"Simpan &amp; Terbitkan Quotation"</strong>.
          </div>
        </div>
      ` : ''}

      ${isRejected ? `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 11px 16px; display: flex; align-items: flex-start; gap: 10px; font-size: 12px; color: #991b1b;">
          <i data-lucide="alert-triangle" style="width: 18px; height: 18px; color: #dc2626; flex-shrink: 0; margin-top: 1px;"></i>
          <div>
            <strong>Penawaran Pernah Ditolak:</strong> ${escapeHtml(quotationData.rejectionNotes || 'Silakan perbaiki rincian penawaran lalu tekan "Simpan & Terbitkan Ulang" atau simpan sebagai Draft.')}
          </div>
        </div>
      ` : ''}

      <!-- CARD 1: PILIHAN TIPE PENAWARAN & INFORMASI CUSTOMER -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        
        <!-- PILIHAN TIPE PENAWARAN (PRODUK MANUFAKTUR vs JASA NON-BOM) -->
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <label class="form-label font-bold" style="font-size: 12px; margin-bottom: 2px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="layers" style="width: 15px; height: 15px; color: #2563eb;"></i> Kategori / Tipe Penawaran *
            </label>
            <span style="font-size: 11px; color: #64748b;">Pilih produk manufaktur (memerlukan BOM) atau jasa/layanan pekerjaan (Non-BOM pada Order Penjualan).</span>
          </div>
          <div style="display: inline-flex; gap: 10px; align-items: center;">
            <label id="quo-opt-produk-label" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1.5px solid ${isJasa ? '#cbd5e1' : '#3b82f6'}; background: ${isJasa ? '#f8fafc' : '#eff6ff'}; font-weight: ${isJasa ? '500' : '700'}; color: ${isJasa ? '#64748b' : '#1d4ed8'}; font-size: 12px; transition: all 0.2s;">
              <input type="radio" name="quotationType" value="produk" ${!isJasa ? 'checked' : ''} onchange="toggleQuotationTypeUI('produk')" style="cursor: pointer;">
              <span>📦 Produk Manufaktur (BOM)</span>
            </label>
            <label id="quo-opt-jasa-label" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px; cursor: pointer; border: 1.5px solid ${isJasa ? '#10b981' : '#cbd5e1'}; background: ${isJasa ? '#ecfdf5' : '#f8fafc'}; font-weight: ${isJasa ? '700' : '500'}; color: ${isJasa ? '#047857' : '#64748b'}; font-size: 12px; transition: all 0.2s;">
              <input type="radio" name="quotationType" value="jasa" ${isJasa ? 'checked' : ''} onchange="toggleQuotationTypeUI('jasa')" style="cursor: pointer;">
              <span>🛠️ Jasa / Layanan (Non-BOM)</span>
            </label>
          </div>
        </div>

        <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="building-2" style="width: 16px; height: 16px; color: #2563eb;"></i> Informasi Calon Pelanggan & Status Penawaran
        </h4>

        <div style="display: grid; grid-template-columns: 1.4fr 1.4fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label">Nama Calon Pelanggan / Perusahaan</label>
            <input type="text" name="customerName" class="form-control" placeholder="PT / CV / Instansi (Bisa dikosongkan jika ingin ditulis tangan)" value="${escapeAttr(custVal)}">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Project / Pekerjaan *</label>
            <input type="text" name="projectName" class="form-control" placeholder="Contoh: Smart Water IoT Monitoring System" required value="${escapeAttr(quotationData?.projectName || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Nama PIC / Kontak Person (Customer)</label>
            <input type="text" name="picName" class="form-control" placeholder="Contoh: Bpk. Andi Pratama (Purchasing / Kontak Customer)" value="${escapeAttr(quotationData?.picName || '')}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px;">
          <div class="form-group">
            <label class="form-label">No. Telepon / WhatsApp *</label>
            <input type="text" name="customerPhone" class="form-control" placeholder="Contoh: 081234567890" required value="${escapeAttr(quotationData?.customerPhone || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Email Pelanggan</label>
            <input type="email" name="customerEmail" class="form-control" placeholder="email@perusahaan.com" value="${escapeAttr(quotationData?.customerEmail || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Tanggal Penawaran *</label>
            <input type="date" name="quotationDate" class="form-control" required value="${quotationData?.quotationDate || today}">
          </div>
          <div class="form-group">
            <label class="form-label">Masa Berlaku Hingga (Valid Until)</label>
            <input type="date" name="validUntil" class="form-control" value="${quotationData?.validUntil || defaultValidDate}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-top: 14px;">
          <div class="form-group">
            <label class="form-label">Alamat Lengkap Customer</label>
            <input type="text" name="customerAddress" class="form-control" placeholder="Kawasan industri, alamat kantor atau pabrik calon pembeli" value="${escapeAttr(quotationData?.customerAddress || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Status Penawaran</label>
            <input type="hidden" name="status" value="${quotationData?.status || 'Sent'}">
            <div class="form-control" style="background: #f8fafc; border: 1px solid #cbd5e1; display: flex; align-items: center; gap: 8px; font-weight: 700; color: ${statusColor}; cursor: default; font-size: 11.5px;">
              <i data-lucide="${statusIcon}" style="width: 15px; height: 15px; flex-shrink: 0;"></i>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${statusLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- CARD 2: RINCIAN PRODUK / JASA UTAMA & SUB RINCIAN JASA / INSTALASI -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        
        <!-- BAGIAN 1: PRODUK / JASA UTAMA -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 id="quo-section-1-title" style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i data-lucide="${isJasa ? 'wrench' : 'package'}" style="width: 16px; height: 16px; color: #10b981;"></i> ${isJasa ? '1. Rincian Penawaran Jasa & Layanan Pekerjaan (Non-BOM)' : '1. Rincian Penawaran Harga Produk Utama'}
            </h4>
            <p id="quo-section-1-desc" style="font-size: 11px; color: var(--text-muted); margin: 2px 0 0 0;">${isJasa ? 'Rincian pekerjaan/jasa yang akan langsung diproses ke Penugasan Tim & Project Management (Tanpa formulasi BOM).' : 'Barang/produk utama yang akan diproses ke Order Penjualan, formulasi BOM, & Purchasing'}</p>
          </div>
          <button type="button" class="btn btn-sm btn-primary" onclick="addQuotationItemRow()" style="font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;">
            <i data-lucide="plus"></i> <span id="quo-btn-add-item-text">${isJasa ? 'Tambah Baris Jasa/Pekerjaan' : 'Tambah Baris Produk'}</span>
          </button>
        </div>

        <div style="border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; margin-bottom: 18px;">
          <div id="quo-items-header" style="display: grid; grid-template-columns: ${isJasa ? 'minmax(0, 3fr) minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px' : 'minmax(0, 2.4fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px'}; gap: 8px; background: #f8fafc; padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-size: 11px; font-weight: 700; color: #475569;">
            <div id="quo-col-item-name">${isJasa ? 'Nama Jasa / Uraian Pekerjaan *' : 'Nama Produk / Deskripsi Item *'}</div>
            <div id="quo-col-item-sku">${isJasa ? 'Kode Jasa' : 'Kode / SKU'}</div>
            <div id="quo-col-item-warranty" style="${isJasa ? 'display: none;' : ''}">Garansi (Bulan)</div>
            <div id="quo-col-item-qty">Qty *</div>
            <div id="quo-col-item-unit" style="${isJasa ? 'display: none;' : ''}">Satuan</div>
            <div id="quo-col-item-price">${isJasa ? 'Tarif / Biaya (Rp) *' : 'Harga Satuan (Rp) *'}</div>
            <div>Total (Rp)</div>
            <div></div>
          </div>
          <div id="quotation-items-list" style="padding: 8px; display: flex; flex-direction: column; gap: 6px; background: #ffffff; max-height: 220px; overflow-y: auto; overflow-x: hidden;">
            <!-- Dynamically populated rows -->
          </div>
        </div>

        <!-- BAGIAN 2: SUB INPUT JASA & INSTALASI (KETERANGAN PENAWARAN) -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h4 style="font-size: 13px; font-weight: 700; color: #166534; margin: 0; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="wrench" style="width: 16px; height: 16px; color: #16a34a;"></i> 2. Sub Rincian Biaya Jasa Tambahan (Instalasi, Setting, Comm, dll.)
              </h4>
              <p style="font-size: 11px; color: #15803d; margin: 2px 0 0 0;">
                💡 <strong>Keterangan:</strong> Biaya jasa ini <strong>masuk ke Total Harga & tercetak di Quotation PDF</strong>, namun <strong>tidak terhubung ke BOM & Purchasing</strong>.
              </p>
            </div>
            <button type="button" class="btn btn-sm" onclick="addQuotationServiceRow()" style="background: #16a34a; color: #ffffff; border-color: #16a34a; font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px;">
              <i data-lucide="plus"></i> Tambah Sub Jasa / Instalasi
            </button>
          </div>

          <div style="border: 1px solid #86efac; border-radius: 6px; overflow: hidden; background: #ffffff;">
            <div style="display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; background: #ecfdf5; padding: 8px 12px; border-bottom: 1px solid #86efac; font-size: 11px; font-weight: 700; color: #166534;">
              <div>Deskripsi Jasa / Biaya Tambahan (Instalasi, Commissioning, dll.)</div>
              <div>Qty</div>
              <div>Satuan</div>
              <div>Biaya Satuan (Rp)</div>
              <div>Total (Rp)</div>
              <div></div>
            </div>
            <div id="quotation-services-list" style="padding: 8px; display: flex; flex-direction: column; gap: 6px; background: #ffffff; max-height: 180px; overflow-y: auto; overflow-x: hidden;">
              <!-- Dynamically populated service rows -->
            </div>
          </div>
        </div>

      </div>

      <!-- CARD 3: KETENTUAN GARANSI, WAKTU PENGIRIMAN & PEMBAYARAN -->
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 18px 20px;">
        <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="shield-check" style="width: 16px; height: 16px; color: #8b5cf6;"></i> Ketentuan Lead Time & Pembayaran
        </h4>

        <div id="quo-card3-grid" style="display: grid; grid-template-columns: ${isJasa ? '1fr 1.2fr' : '1.2fr 1fr 1.2fr'}; gap: 14px;">
          <div class="form-group" id="quo-warranty-clause-group" style="${isJasa ? 'display: none;' : ''}">
            <label class="form-label">Klausul Garansi Produk</label>
            <input type="text" id="quo-warranty-clause-input" name="warranty" class="form-control" placeholder="Contoh: Garansi 12 Bulan suku cadang & servis (Otomatis 'Tidak Ada Garansi' jika 0 bulan)" value="${escapeAttr(quotationData?.warranty || (isJasa ? '' : 'Garansi resmi 12 bulan untuk suku cadang dan servis'))}" oninput="handleQuotationClauseWarrantyInput(this)">
          </div>
          <div class="form-group">
            <label class="form-label">Estimasi Waktu Pelaksanaan / Pengiriman (Lead Time)</label>
            <input type="text" name="leadTime" class="form-control" placeholder="Contoh: 14 hari kerja setelah PO" value="${escapeAttr(quotationData?.leadTime || (isJasa ? '7-14 hari kerja setelah PO resmi' : '14 hari kerja setelah PO resmi diterima'))}">
          </div>
          <div class="form-group">
            <label class="form-label">Syarat Pembayaran (Payment Terms)</label>
            <input type="text" name="paymentTerms" class="form-control" placeholder="Contoh: DP 50%, Pelunasan sebelum kirim" value="${escapeAttr(quotationData?.paymentTerms || 'DP 50% saat PO, Pelunasan setelah serah terima / BAST')}">
          </div>
        </div>
      </div>

      <!-- CARD 4: CATATAN & KALKULASI FINANSIAL -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; align-items: start;">
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="file-text" style="width: 14px; height: 14px; color: #64748b;"></i> Syarat & Ketentuan Tambahan
          </label>
          <textarea name="notes" class="form-control" rows="5" placeholder="Ketentuan ruang lingkup pekerjaan, akomodasi, toleransi, dll...">${escapeAttr(cleanNotesVal)}</textarea>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 18px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px;">
              <span class="text-muted" id="quo-label-main-items-total">${isJasa ? 'Total Biaya Jasa Utama:' : 'Total Produk Utama:'}</span>
              <span id="quo-main-items-total" class="font-mono font-bold text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #15803d;">
              <span>Sub Jasa & Instalasi:</span>
              <span id="quo-services-total" class="font-mono font-bold">+ Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
              <span class="text-muted font-bold">Total Nilai Penawaran:</span>
              <span id="quo-items-total" class="font-mono font-bold text-main">Rp 0</span>
            </div>
            <div id="quo-warranty-fee-row" style="display: ${isJasa ? 'none' : 'flex'}; justify-content: space-between; align-items: center; font-size: 13px; background: #f0fdf4; padding: 6px 10px; border-radius: 6px; border: 1px dashed #86efac;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span id="quo-warranty-fee-label" class="font-bold text-success" style="color: #16a34a; font-size: 12.5px;">+ Biaya Garansi (5%):</span>
              </div>
              <span id="quo-warranty-fee" class="font-mono font-bold text-success" style="color: #16a34a;">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <span class="text-muted font-bold" id="quo-subtotal-label">${isJasa ? 'Subtotal:' : 'Subtotal (Item + Garansi):'}</span>
              <span id="quo-subtotal" class="font-mono font-bold text-main">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="text-muted font-bold">Potongan / Diskon (Rp):</span>
              </div>
              <input type="number" id="quo-discount" name="discount" value="${quotationData?.discount ?? 0}" min="0" style="width: 130px; height: 28px; padding: 2px 8px; font-size: 12px; font-family: monospace; border: 1px solid var(--border-color); border-radius: 4px; text-align: right;" oninput="calculateQuotationTotals()">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="text-muted font-bold">PPN (%):</span>
                <input type="number" id="quo-tax-rate" name="taxRate" value="${quotationData?.taxRate ?? 11}" min="0" max="100" style="width: 55px; height: 26px; padding: 2px 6px; font-size: 12px; border: 1px solid var(--border-color); border-radius: 4px;" oninput="calculateQuotationTotals()">
              </div>
              <span id="quo-tax-amount" class="font-mono text-muted">Rp 0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #0f172a; padding-top: 10px; font-size: 15px;">
              <span class="font-bold text-main">Grand Total:</span>
              <span id="quo-grand-total" class="font-mono font-bold text-primary" style="font-size: 18px;">Rp 0</span>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL FOOTER ACTIONS -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding-top: 16px; border-top: 1px solid var(--border-color); margin-top: 6px; flex-wrap: wrap;">
        <div style="font-size: 11px; color: #64748b; display: flex; align-items: center; gap: 6px;">
          <i data-lucide="database" style="width: 14px; height: 14px; color: #2563eb;"></i>
          <span>${canSaveAsDraft ? 'Draft tersimpan di Supabase &amp; tidak dikirim ke Ketua UBM / Direktur sampai diterbitkan.' : 'Perubahan disimpan langsung ke database Supabase.'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn btn-outline" onclick="closeModal('form-modal')">Batal</button>
          ${canSaveAsDraft ? `
            <button type="button" id="btn-quo-save-draft" class="btn btn-outline" onclick="submitQuotation(event, '${isEdit ? quotationData.id : ''}', 'draft')" style="padding: 10px 18px; font-weight: 600; border-color: #64748b; color: #334155; background: #f8fafc; display: inline-flex; align-items: center; gap: 7px;" title="Simpan sebagai Draft di Supabase tanpa mengirim ke Ketua UBM atau Direktur">
              <i data-lucide="file-clock" style="width: 15px; height: 15px;"></i> Simpan Draft
            </button>
          ` : ''}
          <button type="submit" id="btn-quo-submit-publish" class="btn btn-primary" style="padding: 10px 24px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
            <i data-lucide="${(!isEdit || isDraft || isRejected) ? 'send' : 'save'}"></i> ${(!isEdit || isDraft) ? 'Simpan &amp; Terbitkan Quotation' : (isRejected ? 'Simpan &amp; Terbitkan Ulang' : 'Perbarui Quotation')}
          </button>
        </div>
      </div>
    </form>
  `;

  const itemsContainer = document.getElementById('quotation-items-list');
  if (quotationData && quotationData.items && quotationData.items.length > 0) {
    quotationData.items.forEach(item => addQuotationItemRow(item));
  } else {
    addQuotationItemRow();
  }

  // Populate additional services if present
  if (quotationData && quotationData.additionalServices && quotationData.additionalServices.length > 0) {
    quotationData.additionalServices.forEach(svc => addQuotationServiceRow(svc));
  }

  calculateQuotationTotals();
  openModal('form-modal');
  if (window.lucide) lucide.createIcons();
}

// Helper: Ekstrak jumlah bulan garansi (angka) dari nilai garansi
function parseQuotationWarrantyMonths(rawVal, defaultMonths = 12) {
  if (rawVal === undefined || rawVal === null) return defaultMonths;
  if (typeof rawVal === 'number') return Math.max(0, Math.floor(rawVal));
  const str = String(rawVal).trim().toLowerCase();
  if (!str || str === '-' || str === '0' || str.includes('tidak ada') || str.includes('tanpa garansi') || str.includes('non garansi') || str.includes('no warranty')) {
    return 0;
  }
  const match = str.match(/(\d+)/);
  if (match) {
    return Math.max(0, parseInt(match[1], 10));
  }
  return defaultMonths;
}

function handleQuotationWarrantyInput(inputEl) {
  if (inputEl) {
    const raw = inputEl.value;
    const months = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
    const row = inputEl.closest('.quotation-item-row');
    const statusEl = row ? row.querySelector('.item-warranty-status') : null;
    if (statusEl) {
      statusEl.textContent = months > 0 ? `Garansi ${months} Bulan` : 'Tidak Ada Garansi';
      statusEl.style.color = months > 0 ? '#16a34a' : '#64748b';
    }
  }

  // Sinkronkan Klausul Garansi Produk dengan angka bulan garansi item
  const warrantyInputs = Array.from(document.querySelectorAll('.quotation-item-row .item-warranty'));
  const monthsList = warrantyInputs.map(el => Math.max(0, parseInt(el.value, 10) || 0));
  const maxMonths = monthsList.length > 0 ? Math.max(...monthsList) : 0;

  const clauseInput = document.getElementById('quo-warranty-clause-input');
  if (clauseInput) {
    const currentClause = clauseInput.value.trim();
    if (maxMonths <= 0) {
      clauseInput.value = 'Tidak Ada Garansi';
    } else if (
      !currentClause ||
      currentClause.toLowerCase() === 'tidak ada garansi' ||
      currentClause === '-' ||
      currentClause === '0' ||
      /^garansi resmi \d+ bulan/i.test(currentClause) ||
      /^\d+\s*bulan$/i.test(currentClause)
    ) {
      clauseInput.value = `Garansi resmi ${maxMonths} bulan untuk suku cadang dan servis`;
    }
  }

  calculateQuotationTotals();
}

function handleQuotationClauseWarrantyInput(clauseEl) {
  if (!clauseEl) return;
  const val = clauseEl.value.trim().toLowerCase();
  if (val === '0' || val === '0 bulan' || val === 'tidak ada garansi' || val === 'tanpa garansi') {
    document.querySelectorAll('.quotation-item-row').forEach(row => {
      const wInput = row.querySelector('.item-warranty');
      const statusEl = row.querySelector('.item-warranty-status');
      if (wInput) wInput.value = 0;
      if (statusEl) {
        statusEl.textContent = 'Tidak Ada Garansi';
        statusEl.style.color = '#64748b';
      }
    });
    if (val === '0' || val === '0 bulan') {
      clauseEl.value = 'Tidak Ada Garansi';
    }
  }
  calculateQuotationTotals();
}

// Helper: Generator Kode / SKU Unik & Otomatis untuk Rincian Penawaran Harga
let _quoSkuSeqCounter = 0;
function generateUniqueQuotationSku(prefix = 'SKU', extraExisting = []) {
  const safePrefix = String(prefix || 'SKU').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SKU';
  const used = new Set();

  (Array.isArray(extraExisting) ? extraExisting : []).forEach(c => {
    if (c) used.add(String(c).trim().toUpperCase());
  });
  (state.quotations || []).forEach(q => {
    (q?.items || []).forEach(it => {
      if (it && it.sku) used.add(String(it.sku).trim().toUpperCase());
    });
  });
  (state.orders || []).forEach(o => {
    (o?.items || []).forEach(it => {
      if (it && it.sku) used.add(String(it.sku).trim().toUpperCase());
    });
  });
  (state.bom || []).forEach(b => {
    if (b && b.productCode) used.add(String(b.productCode).trim().toUpperCase());
  });
  if (typeof document !== 'undefined' && document.querySelectorAll) {
    document.querySelectorAll('.quotation-item-row .item-sku').forEach(el => {
      if (el && el.value) used.add(String(el.value).trim().toUpperCase());
    });
  }

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yy}${mm}${dd}`;

  for (let attempt = 0; attempt < 50; attempt++) {
    _quoSkuSeqCounter = (_quoSkuSeqCounter + 1) % 10000;
    const randPart = Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(4, 'X');
    const seqSuffix = attempt > 5 ? String(_quoSkuSeqCounter).padStart(2, '0') : '';
    const candidate = `${safePrefix}-${datePart}-${randPart}${seqSuffix}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
  return `${safePrefix}-${datePart}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}
window.generateUniqueQuotationSku = generateUniqueQuotationSku;

function addQuotationItemRow(item = null) {
  const container = document.getElementById('quotation-items-list');
  if (!container) return;

  const typeRadio = document.querySelector('input[name="quotationType"]:checked');
  const isJasa = typeRadio ? (typeRadio.value === 'jasa') : false;

  const defaultUnit = item?.unit || (isJasa ? '' : 'Unit');
  const defaultWarrantyMonths = isJasa
    ? 0
    : (item ? parseQuotationWarrantyMonths(item.warrantyMonths ?? item.warranty, 0) : 12);
  const autoSku = (item && item.sku && String(item.sku).trim())
    ? String(item.sku).trim()
    : generateUniqueQuotationSku(isJasa ? 'JASA' : 'SKU');

  const row = document.createElement('div');
  row.className = 'quotation-item-row';
  row.style = `display: grid; grid-template-columns: ${isJasa ? 'minmax(0, 3fr) minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px' : 'minmax(0, 2.4fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px'}; gap: 8px; align-items: center;`;

  row.innerHTML = `
    <div>
      <input type="text" class="form-control item-name" placeholder="${isJasa ? 'Uraian pekerjaan / layanan jasa' : 'Nama produk penawaran'}" required value="${escapeAttr(item?.itemName || '')}">
    </div>
    <div>
      <input type="text" class="form-control item-sku" readonly placeholder="${isJasa ? 'KODE-JASA (Otomatis)' : 'SKU Otomatis'}" value="${escapeAttr(autoSku)}" style="background: #f8fafc; font-family: monospace; font-weight: 700; font-size: 11px; color: #1e40af; cursor: default;" title="Kode / SKU dibuat unik dan otomatis oleh sistem">
    </div>
    <div class="quo-cell-warranty" style="${isJasa ? 'display: none;' : ''}">
      <div style="position: relative; display: flex; align-items: center;">
        <input type="number" class="form-control item-warranty" placeholder="0" min="0" max="120" step="1" value="${defaultWarrantyMonths}" oninput="handleQuotationWarrantyInput(this)" style="padding-right: 30px; font-weight: 600; text-align: center;" title="Masukkan angka bulan garansi (Isi 0 jika tidak ada garansi)">
        <span style="position: absolute; right: 7px; font-size: 10px; font-weight: 700; color: #64748b; pointer-events: none;">Bln</span>
      </div>
      <div class="item-warranty-status" style="font-size: 9.5px; margin-top: 2px; font-weight: 600; text-align: center; color: ${defaultWarrantyMonths > 0 ? '#16a34a' : '#64748b'};">
        ${defaultWarrantyMonths > 0 ? `Garansi ${defaultWarrantyMonths} Bulan` : 'Tidak Ada Garansi'}
      </div>
    </div>
    <div>
      <input type="number" class="form-control item-qty" placeholder="1" min="1" step="any" required value="${item?.qty || 1}" oninput="calculateQuotationTotals()">
    </div>
    <div class="quo-cell-unit" style="${isJasa ? 'display: none;' : ''}">
      <input type="text" class="form-control item-unit" placeholder="${isJasa ? '' : 'Unit/Pcs'}" value="${escapeAttr(defaultUnit)}">
    </div>
    <div>
      <input type="number" class="form-control item-price" placeholder="0" min="0" step="500" required value="${item?.unitPrice || 0}" oninput="calculateQuotationTotals()">
    </div>
    <div>
      <input type="text" class="form-control item-total" readonly style="background: #f8fafc; font-family: monospace; font-weight: 600;" value="Rp 0">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Baris" onclick="removeQuotationItemRow(this)">
        <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
  calculateQuotationTotals();
}

function removeQuotationItemRow(btn) {
  const container = document.getElementById('quotation-items-list');
  if (!container) return;
  if (container.querySelectorAll('.quotation-item-row').length <= 1) {
    showToast('Minimal harus ada 1 baris item produk utama!', 'warning');
    return;
  }
  btn.closest('.quotation-item-row').remove();
  handleQuotationWarrantyInput();
}

function addQuotationServiceRow(service = null) {
  const container = document.getElementById('quotation-services-list');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'quotation-service-row';
  row.style = 'display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1.4fr) minmax(0, 1.4fr) 40px; gap: 8px; align-items: center;';

  row.innerHTML = `
    <div>
      <input type="text" class="form-control service-name" placeholder="Contoh: Jasa Instalasi & Penarikan Kabel di Lokasi" required value="${escapeAttr(service?.serviceName || '')}">
    </div>
    <div>
      <input type="number" class="form-control service-qty" placeholder="1" min="1" step="any" required value="${service?.qty || 1}" oninput="calculateQuotationTotals()">
    </div>
    <div>
      <input type="text" class="form-control service-unit" placeholder="Lot/Titik/Hari" value="${escapeAttr(service?.unit || 'Lot')}">
    </div>
    <div>
      <input type="number" class="form-control service-price" placeholder="0" min="0" step="500" required value="${service?.unitPrice || 0}" oninput="calculateQuotationTotals()">
    </div>
    <div>
      <input type="text" class="form-control service-total" readonly style="background: #f8fafc; font-family: monospace; font-weight: 600;" value="Rp 0">
    </div>
    <div style="text-align: center;">
      <button type="button" class="btn-icon btn-danger-ghost" title="Hapus Baris Jasa" onclick="removeQuotationServiceRow(this)">
        <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
  calculateQuotationTotals();
}

function removeQuotationServiceRow(btn) {
  btn.closest('.quotation-service-row').remove();
  calculateQuotationTotals();
}

function calculateQuotationTotals() {
  const itemRows = document.querySelectorAll('.quotation-item-row');
  let mainItemsTotal = 0;
  let warrantedItemsTotal = 0;
  let maxWarrantyMonths = 0;
  let allItemsHaveWarranty = itemRows.length > 0;

  itemRows.forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
    const total = qty * price;
    mainItemsTotal += total;

    const wInput = row.querySelector('.item-warranty');
    const warrantyMonths = wInput ? Math.max(0, parseInt(wInput.value, 10) || 0) : 0;
    if (warrantyMonths > 0) {
      warrantedItemsTotal += total;
      if (warrantyMonths > maxWarrantyMonths) maxWarrantyMonths = warrantyMonths;
    } else {
      allItemsHaveWarranty = false;
    }

    const statusEl = row.querySelector('.item-warranty-status');
    if (statusEl) {
      statusEl.textContent = warrantyMonths > 0 ? `Garansi ${warrantyMonths} Bulan` : 'Tidak Ada Garansi';
      statusEl.style.color = warrantyMonths > 0 ? '#16a34a' : '#64748b';
    }

    const totalInput = row.querySelector('.item-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  const serviceRows = document.querySelectorAll('.quotation-service-row');
  let servicesTotal = 0;

  serviceRows.forEach(row => {
    const qty = parseFloat(row.querySelector('.service-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.service-price')?.value) || 0;
    const total = qty * price;
    servicesTotal += total;

    const totalInput = row.querySelector('.service-total');
    if (totalInput) totalInput.value = formatRupiah(total);
  });

  const typeRadio = document.querySelector('input[name="quotationType"]:checked');
  const isJasa = typeRadio ? (typeRadio.value === 'jasa') : false;

  // Biaya Garansi 5% hanya berlaku untuk Produk Manufaktur dengan garansi > 0 bulan. Jika 0 bulan maka tidak ada garansi (Rp 0).
  const itemsTotal = mainItemsTotal + servicesTotal;
  const hasWarranty = !isJasa && maxWarrantyMonths > 0;
  const warrantyBase = allItemsHaveWarranty ? itemsTotal : warrantedItemsTotal;
  const warrantyFee = hasWarranty && warrantyBase > 0 ? Math.round(warrantyBase * 0.05) : 0;
  const subtotal = itemsTotal + warrantyFee;

  const discountInput = document.getElementById('quo-discount');
  const discount = Math.max(0, parseFloat(discountInput?.value) || 0);

  const taxableAmount = Math.max(0, subtotal - discount);

  const taxRateInput = document.getElementById('quo-tax-rate');
  const taxRate = parseFloat(taxRateInput?.value) || 0;
  const taxAmount = Math.round(taxableAmount * (taxRate / 100));
  const grandTotal = taxableAmount + taxAmount;

  const mainItemsTotalEl = document.getElementById('quo-main-items-total');
  if (mainItemsTotalEl) mainItemsTotalEl.textContent = formatRupiah(mainItemsTotal);

  const servicesTotalEl = document.getElementById('quo-services-total');
  if (servicesTotalEl) servicesTotalEl.textContent = formatRupiah(servicesTotal);

  const itemsTotalEl = document.getElementById('quo-items-total');
  if (itemsTotalEl) itemsTotalEl.textContent = formatRupiah(itemsTotal);

  const warrantyFeeRow = document.getElementById('quo-warranty-fee-row');
  const warrantyFeeLabel = document.getElementById('quo-warranty-fee-label');
  const warrantyFeeEl = document.getElementById('quo-warranty-fee');
  const subtotalLabel = document.getElementById('quo-subtotal-label');

  if (warrantyFeeRow && !isJasa) {
    if (hasWarranty) {
      warrantyFeeRow.style.background = '#f0fdf4';
      warrantyFeeRow.style.borderColor = '#86efac';
      if (warrantyFeeLabel) {
        warrantyFeeLabel.textContent = `+ Biaya Garansi (5% • ${maxWarrantyMonths} Bulan):`;
        warrantyFeeLabel.style.color = '#16a34a';
      }
      if (warrantyFeeEl) {
        warrantyFeeEl.textContent = formatRupiah(warrantyFee);
        warrantyFeeEl.style.color = '#16a34a';
      }
      if (subtotalLabel) subtotalLabel.textContent = 'Subtotal (Item + Garansi):';
    } else {
      warrantyFeeRow.style.background = '#f8fafc';
      warrantyFeeRow.style.borderColor = '#cbd5e1';
      if (warrantyFeeLabel) {
        warrantyFeeLabel.textContent = 'Biaya Garansi (0 Bulan • Tidak Ada Garansi):';
        warrantyFeeLabel.style.color = '#64748b';
      }
      if (warrantyFeeEl) {
        warrantyFeeEl.textContent = 'Rp 0 (Tidak Ada Garansi)';
        warrantyFeeEl.style.color = '#64748b';
      }
      if (subtotalLabel) subtotalLabel.textContent = 'Subtotal (Tanpa Garansi):';
    }
  } else if (warrantyFeeEl) {
    warrantyFeeEl.textContent = formatRupiah(warrantyFee);
  }

  const subtotalEl = document.getElementById('quo-subtotal');
  if (subtotalEl) subtotalEl.textContent = formatRupiah(subtotal);

  const taxEl = document.getElementById('quo-tax-amount');
  if (taxEl) taxEl.textContent = formatRupiah(taxAmount);

  const grandEl = document.getElementById('quo-grand-total');
  if (grandEl) grandEl.textContent = formatRupiah(grandTotal);

  return { mainItemsTotal, servicesTotal, itemsTotal, warrantyFee, hasWarranty, maxWarrantyMonths, subtotal, discount, taxRate, taxAmount, grandTotal };
}

// -------------------------------------------------------------
// SUBMIT QUOTATION (SAVE AS DRAFT OR PUBLISH)
// -------------------------------------------------------------
async function submitQuotation(event, id, saveMode = 'publish') {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  if (isQuotationReadOnlyForUser()) {
    showToast('⚠️ Role PPIC hanya memiliki akses melihat pada halaman Quotation.', 'warning');
    return;
  }

  const form = (event && event.target && event.target.tagName === 'FORM')
    ? event.target
    : (event?.target?.closest?.('form') || document.getElementById('quotation-form'));
  if (!form) {
    showToast('Formulir Quotation tidak ditemukan!', 'error');
    return;
  }

  const isEdit = !!id;
  const isDraftSave = saveMode === 'draft';
  const existingQuo = isEdit ? (state.quotations || []).find(q => q.id === id) : null;

  if (isEdit) {
    if (existingQuo && isQuotationDraft(existingQuo) && !isQuotationVisibleToUser(existingQuo)) {
      showToast('🔒 Draft Quotation ini hanya dapat diubah oleh pembuat draft atau Administrator.', 'warning');
      return;
    }
    const existingOrder = (state.orders || []).find(o => o.quotationId === id || (o.notes && o.notes.includes(id)));
    if (existingOrder) {
      showToast(`⚠️ Surat Penawaran #${id} tidak dapat diedit/disimpan karena sudah dikonversikan ke Order Penjualan #${existingOrder.id}!`, 'error');
      return;
    }
    if (isDraftSave && existingQuo && (existingQuo.approvalKetuaUbm || existingQuo.approvalDirektur)) {
      showToast(`⚠️ Quotation #${id} sudah memiliki persetujuan pimpinan dan tidak dapat dikembalikan ke Draft.`, 'warning');
      return;
    }
  }

  if (!isDraftSave && typeof form.checkValidity === 'function' && !form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const quotationType = form.querySelector('input[name="quotationType"]:checked')?.value || 'produk';
  const isJasa = quotationType === 'jasa';

  const items = [];
  const usedSkusInForm = new Set();
  const rows = document.querySelectorAll('.quotation-item-row');
  rows.forEach((row, idx) => {
    const rawItemName = row.querySelector('.item-name')?.value.trim() || '';
    let sku = row.querySelector('.item-sku')?.value.trim() || '';
    const rawWarrantyVal = row.querySelector('.item-warranty')?.value;
    const warrantyMonths = isJasa ? 0 : Math.max(0, parseInt(rawWarrantyVal, 10) || 0);
    const warranty = isJasa ? '' : (warrantyMonths > 0 ? `${warrantyMonths} Bulan` : 'Tidak Ada Garansi');
    const qty = parseFloat(row.querySelector('.item-qty')?.value) || 1;
    const unit = isJasa ? '' : (row.querySelector('.item-unit')?.value.trim() || 'Unit');
    const unitPrice = parseFloat(row.querySelector('.item-price')?.value) || 0;
    const total = qty * unitPrice;

    if (rawItemName || (isDraftSave && unitPrice > 0)) {
      if (!sku || usedSkusInForm.has(sku.toUpperCase())) {
        sku = generateUniqueQuotationSku(isJasa ? 'JASA' : 'SKU', Array.from(usedSkusInForm));
        const skuInput = row.querySelector('.item-sku');
        if (skuInput) skuInput.value = sku;
      }
      usedSkusInForm.add(sku.toUpperCase());
      items.push({
        itemName: rawItemName || `Item Draft ${idx + 1}`,
        sku,
        warranty,
        warrantyMonths,
        qty,
        unit,
        unitPrice,
        total
      });
    }
  });

  if (!isDraftSave && items.length === 0) {
    showToast('Harap masukkan minimal 1 barang/produk penawaran utama!', 'warning');
    return;
  }

  const additionalServices = [];
  document.querySelectorAll('.quotation-service-row').forEach(row => {
    const serviceName = row.querySelector('.service-name')?.value.trim();
    const qty = parseFloat(row.querySelector('.service-qty')?.value) || 1;
    const unit = isJasa ? '' : (row.querySelector('.service-unit')?.value.trim() || 'Lot');
    const unitPrice = parseFloat(row.querySelector('.service-price')?.value) || 0;
    const total = qty * unitPrice;
    if (serviceName) {
      additionalServices.push({ serviceName, qty, unit, unitPrice, total });
    }
  });

  const { mainItemsTotal, servicesTotal, itemsTotal, warrantyFee, hasWarranty, maxWarrantyMonths, subtotal, discount, taxRate, taxAmount, grandTotal } = calculateQuotationTotals();

  const rawFormWarranty = form.warranty ? form.warranty.value.trim() : '';
  const finalWarrantyText = isJasa
    ? '-'
    : (hasWarranty
        ? (rawFormWarranty && rawFormWarranty.toLowerCase() !== 'tidak ada garansi' && rawFormWarranty !== '0'
            ? rawFormWarranty
            : `Garansi resmi ${maxWarrantyMonths} bulan untuk suku cadang dan servis`)
        : 'Tidak Ada Garansi');

  const today = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();
  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : (typeof getLoggedInUser === 'function' ? getLoggedInUser() : null);
  const targetId = isEdit ? id : `QUO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;

  const cleanUserNotes = getQuotationDisplayNotes(form.notes ? form.notes.value.trim() : '');
  const rawCustInput = form.customerName ? form.customerName.value.trim() : '';
  const safeCustomerName = (rawCustInput && rawCustInput !== 'Calon Pelanggan (Ditulis Tangan)') ? rawCustInput : '';

  const wasDraftOrRejected = !isEdit || isQuotationDraft(existingQuo) || existingQuo?.status === 'Rejected';
  const nextStatus = isDraftSave
    ? 'Draft'
    : (wasDraftOrRejected ? 'Sent' : (existingQuo?.status || form.status?.value || 'Sent'));

  const payload = {
    id: targetId,
    quotationType,
    customerName: safeCustomerName,
    projectName: form.projectName ? form.projectName.value.trim() : '',
    picName: form.picName ? form.picName.value.trim() : '',
    customerPhone: form.customerPhone ? form.customerPhone.value.trim() : '',
    customerEmail: form.customerEmail ? form.customerEmail.value.trim() : '',
    customerAddress: form.customerAddress ? form.customerAddress.value.trim() : '',
    quotationDate: (form.quotationDate && form.quotationDate.value) ? form.quotationDate.value : today,
    validUntil: form.validUntil ? form.validUntil.value : '',
    status: nextStatus,
    isDraft: isDraftSave,
    createdBy: existingQuo?.createdBy || activeUser?.email || activeUser?.name || activeUser?.id || '',
    publishedAt: isDraftSave
      ? null
      : (wasDraftOrRejected ? nowIso : (existingQuo?.publishedAt || existingQuo?.createdAt || nowIso)),
    rejectionNotes: isDraftSave ? (existingQuo?.rejectionNotes || null) : (wasDraftOrRejected ? null : (existingQuo?.rejectionNotes || null)),
    warranty: finalWarrantyText,
    warrantyFee: isJasa || !hasWarranty ? 0 : warrantyFee,
    mainItemsTotal,
    servicesTotal,
    itemsTotal,
    leadTime: form.leadTime ? form.leadTime.value.trim() : '',
    paymentTerms: form.paymentTerms ? form.paymentTerms.value.trim() : '',
    notes: cleanUserNotes,
    items,
    additionalServices,
    subtotal,
    discount,
    taxRate,
    taxAmount,
    grandTotal,
    createdAt: existingQuo?.createdAt || nowIso,
    updatedAt: nowIso
  };

  if (isDraftSave || wasDraftOrRejected) {
    payload.approvalKetuaUbm = false;
    payload.approvalKetuaUbmBy = null;
    payload.approvalKetuaUbmDate = null;
    payload.approvalDirektur = false;
    payload.approvalDirekturBy = null;
    payload.approvalDirekturDate = null;
  } else if (existingQuo) {
    payload.approvalKetuaUbm = Boolean(existingQuo.approvalKetuaUbm);
    payload.approvalKetuaUbmBy = existingQuo.approvalKetuaUbmBy || null;
    payload.approvalKetuaUbmDate = existingQuo.approvalKetuaUbmDate || null;
    payload.approvalDirektur = Boolean(existingQuo.approvalDirektur);
    payload.approvalDirekturBy = existingQuo.approvalDirekturBy || null;
    payload.approvalDirekturDate = existingQuo.approvalDirekturDate || null;
    if (typeof embedQuotationApprovalInNotes === 'function' && (payload.approvalKetuaUbm || payload.approvalDirektur)) {
      payload.notes = embedQuotationApprovalInNotes(cleanUserNotes, payload);
    }
  }

  const draftBtn = document.getElementById('btn-quo-save-draft');
  const publishBtn = document.getElementById('btn-quo-submit-publish');
  if (draftBtn) draftBtn.disabled = true;
  if (publishBtn) publishBtn.disabled = true;

  try {
    const saveRes = await persistQuotationRecord(payload, isEdit);
    if (saveRes.ok) {
      const savedItem = saveRes.data || payload;
      closeModal('form-modal');

      if (isDraftSave) {
        showToast(`📝 Draft Quotation #${savedItem.id} berhasil disimpan! Draft TIDAK dikirim ke Ketua UBM maupun Direktur sampai diterbitkan.`, 'success');
      } else if (isEdit && wasDraftOrRejected) {
        showToast(`🚀 Quotation #${savedItem.id} berhasil disimpan & diterbitkan ke Ketua UBM dan Direktur untuk approval!`, 'success');
      } else if (isEdit) {
        showToast(`✅ Quotation #${savedItem.id} berhasil diperbarui!`, 'success');
      } else {
        showToast(`🚀 Quotation #${savedItem.id} berhasil diterbitkan ke Ketua UBM & Direktur dan tersimpan di database!`, 'success');
      }

      await fetchResource('quotations');
      if (!Array.isArray(state.quotations)) state.quotations = [];
      const refreshedIdx = state.quotations.findIndex(q => q.id === savedItem.id);
      if (refreshedIdx === -1) {
        state.quotations.unshift(savedItem);
      } else if (savedItem.updatedAt && (!state.quotations[refreshedIdx].updatedAt || state.quotations[refreshedIdx].updatedAt < savedItem.updatedAt)) {
        state.quotations[refreshedIdx] = { ...state.quotations[refreshedIdx], ...savedItem };
      }

      renderQuotationsTable();
      if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
    } else {
      showToast(saveRes.error || 'Gagal menyimpan penawaran', 'error');
    }
  } catch (err) {
    console.error('Error saving quotation:', err);
    showToast('Terjadi kesalahan saat menyimpan penawaran', 'error');
  } finally {
    if (draftBtn) draftBtn.disabled = false;
    if (publishBtn) publishBtn.disabled = false;
  }
}

async function publishDraftQuotation(id) {
  if (isQuotationReadOnlyForUser()) {
    showToast('⚠️ Role PPIC hanya memiliki akses melihat pada halaman Quotation.', 'warning');
    return;
  }
  const quo = (state.quotations || []).find(q => q.id === id);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }

  if (isQuotationDraft(quo) && !isQuotationVisibleToUser(quo)) {
    showToast('🔒 Hanya pembuat draft atau Administrator yang dapat menerbitkan Draft Quotation ini.', 'warning');
    return;
  }

  if (!isQuotationDraft(quo)) {
    showToast(`Quotation #${quo.id} sudah diterbitkan (${quo.status}).`, 'info');
    return;
  }

  const existingOrder = (state.orders || []).find(o => o.quotationId === quo.id || (o.notes && o.notes.includes(quo.id)));
  if (existingOrder) {
    showToast(`Quotation #${quo.id} sudah terhubung dengan Order #${existingOrder.id}.`, 'warning');
    return;
  }

  const missingFields = [];
  if (!quo.projectName || !String(quo.projectName).trim()) missingFields.push('Nama Project / Pekerjaan');
  if (!quo.customerPhone || !String(quo.customerPhone).trim()) missingFields.push('No. Telepon / WhatsApp');
  if (!quo.quotationDate) missingFields.push('Tanggal Penawaran');
  const validItems = Array.isArray(quo.items)
    ? quo.items.filter(it => it && String(it.itemName || '').trim() && !/^Item Draft(\s+\d+)?$/i.test(String(it.itemName).trim()))
    : [];
  if (validItems.length === 0) missingFields.push('Minimal 1 Item Produk / Jasa');

  if (missingFields.length > 0) {
    showToast(`⚠️ Draft #${quo.id} belum lengkap untuk diterbitkan! Lengkapi: ${missingFields.join(', ')}.`, 'warning');
    closeModal('preview-modal');
    editQuotation(quo.id);
    return;
  }

  if (!confirm(`Terbitkan Draft Quotation #${quo.id}?\n\nSetelah diterbitkan, penawaran ini akan masuk ke antrian persetujuan Ketua UBM dan Direktur.`)) {
    return;
  }

  const nowIso = new Date().toISOString();
  const cleanNotes = getQuotationDisplayNotes(quo._rawNotes || quo.notes || '');
  const publishedQuo = {
    ...quo,
    status: 'Sent',
    isDraft: false,
    publishedAt: nowIso,
    rejectionNotes: null,
    approvalKetuaUbm: false,
    approvalKetuaUbmBy: null,
    approvalKetuaUbmDate: null,
    approvalDirektur: false,
    approvalDirekturBy: null,
    approvalDirekturDate: null,
    notes: cleanNotes,
    updatedAt: nowIso
  };
  delete publishedQuo._rawNotes;

  const saveRes = await persistQuotationRecord(publishedQuo, true);
  if (saveRes.ok) {
    const savedItem = saveRes.data || publishedQuo;
    closeModal('preview-modal');
    showToast(`🚀 Quotation #${quo.id} berhasil diterbitkan! Sekarang masuk ke Ketua UBM & Direktur untuk approval.`, 'success');

    await fetchResource('quotations');
    if (!Array.isArray(state.quotations)) state.quotations = [];
    const refreshedIdx = state.quotations.findIndex(q => q.id === savedItem.id);
    if (refreshedIdx === -1) {
      state.quotations.unshift(savedItem);
    } else if (savedItem.updatedAt && (!state.quotations[refreshedIdx].updatedAt || state.quotations[refreshedIdx].updatedAt < savedItem.updatedAt)) {
      state.quotations[refreshedIdx] = { ...state.quotations[refreshedIdx], ...savedItem };
    }

    renderQuotationsTable();
    if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
  } else {
    showToast(saveRes.error || 'Gagal menerbitkan Draft Quotation', 'error');
  }
}
window.publishDraftQuotation = publishDraftQuotation;

function editQuotation(id) {
  if (isQuotationReadOnlyForUser()) {
    showToast('⚠️ Role PPIC hanya memiliki akses melihat dan tidak dapat mengedit Quotation.', 'warning');
    return;
  }
  const quotation = (state.quotations || []).find(q => q.id === id);
  if (!quotation) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }
  if (isQuotationDraft(quotation) && !isQuotationVisibleToUser(quotation)) {
    showToast('🔒 Draft Quotation ini hanya dapat diakses oleh pembuat draft atau Administrator.', 'warning');
    return;
  }
  const existingOrder = (state.orders || []).find(o => o.quotationId === quotation.id || (o.notes && o.notes.includes(quotation.id)));
  if (existingOrder) {
    showToast(`⚠️ Surat Penawaran #${quotation.id} terkunci dan tidak dapat diedit karena sudah dikonversikan ke Order Penjualan #${existingOrder.id}!`, 'warning');
    return;
  }
  openQuotationModal(quotation);
}

// -------------------------------------------------------------
// DOKUMEN CETAK / PRATINJAU QUOTATION (PDF)
// -------------------------------------------------------------
function buildQuotationPrintableHtml(quo) {
  const isDraft = isQuotationDraft(quo);
  const isJasa = quo.quotationType === 'jasa';
  const cleanQuoNotes = getQuotationDisplayNotes(quo.notes);
  const discountRow = quo.discount > 0 ? `
    <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0;">
      <span>Potongan / Diskon:</span>
      <span class="text-danger" style="color: #ef4444;">- ${formatRupiah(quo.discount)}</span>
    </div>
  ` : '';

  const mainItemsTotalVal = quo.mainItemsTotal !== undefined ? quo.mainItemsTotal : (quo.items ? quo.items.reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0) : 0);
  const servicesTotalVal = quo.servicesTotal !== undefined ? quo.servicesTotal : (quo.additionalServices ? quo.additionalServices.reduce((s, it) => s + (parseFloat(it.total) || (it.qty * it.unitPrice) || 0), 0) : 0);
  const itemsTotalVal = quo.itemsTotal || (mainItemsTotalVal + servicesTotalVal) || quo.subtotal;
  const warrantyFeeVal = isJasa ? 0 : (quo.warrantyFee !== undefined ? quo.warrantyFee : Math.round(itemsTotalVal * 0.05));

  const compSettings = (typeof getCompanySettings === 'function') ? getCompanySettings() : {
    companyName: 'UNIT BISNIS MANDIRI (UBM)',
    parentInstitution: 'POLITEKNIK TAKUMI',
    address: 'Kawasan Industri EJIP Plot 8L, Cikarang Selatan, Bekasi - Jawa Barat',
    phone: '(021) 8990-1234',
    email: 'ubm@takumi.ac.id',
    website: 'ubm.takumi.ac.id',
    copyrightText: 'Copyright © Bisnis Digital Takumi'
  };

  return `
    <div class="doc-preview" style="background: #ffffff; color: #0f172a; width: 100%; max-width: 100%; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- HEADER KOP SURAT UBM -->
      <div class="doc-header" style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">${escapeHtml(compSettings.companyName.toUpperCase())}</div>
          <div style="font-size: 13px; font-weight: 700; color: #2563eb;">${escapeHtml(compSettings.parentInstitution.toUpperCase())}</div>
          <div class="text-muted font-sm" style="margin-top: 4px; line-height: 1.4; font-size: 11px;">
            ${escapeHtml(compSettings.address)}<br>
            Telp: ${escapeHtml(compSettings.phone)} &bull; Email: ${escapeHtml(compSettings.email)} &bull; Web: ${escapeHtml(compSettings.website)}
          </div>
        </div>
        <div class="text-right" style="text-align: right;">
          <h2 style="font-size: 17px; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase;">SURAT PENAWARAN HARGA</h2>
          <div class="font-mono font-bold text-primary" style="font-size: 13.5px; margin-top: 4px;">${quo.id}</div>
          <div style="margin-top: 2px; display: flex; justify-content: flex-end; gap: 4px; flex-wrap: wrap;">
            ${isDraft ? `
              <span class="badge" style="font-size: 9.5px; padding: 2px 6px; background: #e2e8f0; color: #334155; font-weight: 700;">
                📝 DRAFT (BELUM TERBIT)
              </span>
            ` : ''}
            <span class="badge ${isJasa ? 'badge-info' : 'badge-outline'}" style="font-size: 9.5px; padding: 2px 6px;">
              ${isJasa ? '🛠️ Penawaran Jasa & Layanan' : '📦 Penawaran Produk Manufaktur'}
            </span>
          </div>
          <div class="font-sm text-muted" style="margin-top: 2px; font-size: 11.5px;">Tanggal: <strong>${quo.quotationDate || '-'}</strong></div>
          <div class="font-sm" style="color: #e11d48; margin-top: 2px; font-size: 11.5px;">Berlaku s/d: <strong>${quo.validUntil || '-'}</strong></div>
        </div>
      </div>

      <!-- KEPADA YTH & INFORMASI PELANGGAN -->
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; margin-bottom: 18px; padding: 12px 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1;">
        <div>
          <div class="font-sm font-bold text-muted" style="margin-bottom: 4px; font-size: 10.5px; text-transform: uppercase;">KEPADA YTH (CALON CUSTOMER):</div>
          <div style="font-size: 14px; min-height: 24px; border-bottom: 1.5px dotted #64748b; width: 280px; margin-bottom: 6px; letter-spacing: 2px; color: #94a3b8;">......................................................................</div>
          ${quo.projectName ? `<div class="font-sm font-bold" style="font-size: 12px; color: #1e40af; margin-top: 4px;">Project: ${escapeHtml(quo.projectName)}</div>` : ''}
          ${quo.picName ? `<div class="font-sm font-bold text-primary" style="font-size: 11.5px; margin-top: 2px;">UP: ${escapeHtml(quo.picName)}</div>` : ''}
          ${quo.customerAddress && quo.customerAddress !== 'Alamat tidak dicantumkan' ? `<div class="font-sm text-muted" style="margin-top: 2px; font-size: 11px;">${escapeHtml(quo.customerAddress)}</div>` : ''}
          ${quo.customerPhone ? `<div class="font-sm" style="margin-top: 4px; font-size: 11px;">Telp / WA: <strong>${escapeHtml(quo.customerPhone)}</strong></div>` : ''}
        </div>
        <div style="border-left: 1px dashed #cbd5e1; padding-left: 14px;">
          <div class="font-sm font-bold text-muted" style="margin-bottom: 4px; font-size: 10.5px; text-transform: uppercase;">INFORMASI PENAWARAN:</div>
          <div class="font-sm" style="font-size: 11.5px;">No. Referensi: <strong class="font-mono">${quo.id}</strong></div>
          <div class="font-sm mt-1" style="font-size: 11.5px;">Tipe: <strong>${isJasa ? 'Jasa / Layanan' : 'Produk Manufaktur'}</strong></div>
          <div class="font-sm mt-1" style="font-size: 11.5px;">Tanggal Terbit: <strong>${quo.quotationDate || '-'}</strong></div>
          <div class="font-sm mt-1" style="font-size: 11.5px;">Masa Berlaku: <strong>${quo.validUntil || '-'}</strong></div>
          <div class="font-sm mt-1" style="font-size: 11.5px;">Estimasi Lead Time: <strong>${quo.leadTime || (isJasa ? '7-14 hari kerja' : '14 hari kerja')}</strong></div>
        </div>
      </div>

      <!-- TABEL DAFTAR BARANG / JASA (STRICTLY NO HORIZONTAL SCROLL) -->
      <table class="doc-table" style="width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse; margin-bottom: 16px;">
        <colgroup>
          ${isJasa ? `
            <col style="width: 6%;">
            <col style="width: 52%;">
            <col style="width: 10%;">
            <col style="width: 16%;">
            <col style="width: 16%;">
          ` : `
            <col style="width: 5%;">
            <col style="width: 36%;">
            <col style="width: 14%;">
            <col style="width: 8%;">
            <col style="width: 9%;">
            <col style="width: 13%;">
            <col style="width: 15%;">
          `}
        </colgroup>
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">No</th>
            <th style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;">${isJasa ? 'Uraian Pekerjaan / Layanan Jasa' : 'Deskripsi Produk / Layanan Teknik'}</th>
            ${!isJasa ? `<th style="font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">Garansi</th>` : ''}
            <th style="text-align: center; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">Qty</th>
            ${!isJasa ? `<th style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">Satuan</th>` : ''}
            <th style="text-align: right; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${isJasa ? 'Tarif / Biaya' : 'Harga Satuan'}</th>
            <th style="text-align: right; font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;">Total (Rp)</th>
          </tr>
        </thead>
        <tbody>
          ${(quo.items || []).map((it, idx) => `
            <tr>
              <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${idx + 1}</td>
              <td style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1; word-break: break-word;">
                <div class="font-bold">${escapeHtml(it.itemName)}</div>
                ${it.sku ? `<div class="font-sm text-muted font-mono font-xs" style="font-size: 10px;">${isJasa ? 'Kode' : 'SKU'}: ${escapeHtml(it.sku)}</div>` : ''}
              </td>
              ${!isJasa ? `
                <td style="font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1; word-break: break-word;">
                  <span class="badge badge-secondary font-xs" style="font-size: 9.5px; padding: 2px 4px;">${escapeHtml(
                    (it.warrantyMonths === 0 || it.warranty === '0' || it.warranty === '0 Bulan' || String(it.warranty).toLowerCase() === 'tidak ada garansi')
                      ? 'Tidak Ada Garansi'
                      : (it.warrantyMonths > 0 ? `${it.warrantyMonths} Bulan` : (it.warranty || quo.warranty || '12 Bulan'))
                  )}</span>
                </td>
              ` : ''}
              <td style="text-align: center; font-weight: 700; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">${it.qty}</td>
              ${!isJasa ? `
                <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${escapeHtml(it.unit || 'Unit')}</td>
              ` : ''}
              <td style="text-align: right; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(it.unitPrice)}</td>
              <td style="text-align: right; font-weight: 700; font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(it.total || (it.qty * it.unitPrice))}</td>
            </tr>
          `).join('')}
          ${(quo.additionalServices && quo.additionalServices.length > 0) ? `
            <tr style="background: #f8fafc;">
              <td colspan="${isJasa ? '5' : '7'}" style="padding: 6px 8px; font-weight: 700; font-size: 10.5px; color: #4338ca; border: 1px solid #cbd5e1; text-transform: uppercase;">
                Rincian Jasa, Instalasi & Layanan Tambahan (Keterangan Non-BOM)
              </td>
            </tr>
            ${quo.additionalServices.map((svc, sIdx) => `
              <tr>
                <td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${(quo.items?.length || 0) + sIdx + 1}</td>
                <td style="font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1; color: #4338ca; word-break: break-word;">
                  <div class="font-bold">${escapeHtml(svc.serviceName)}</div>
                </td>
                <td style="text-align: center; font-weight: 700; font-size: 11px; padding: 7px 4px; border: 1px solid #cbd5e1;">${svc.qty}</td>
                ${!isJasa ? `<td style="text-align: center; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;">${escapeHtml(svc.unit || 'Lot')}</td>` : ''}
                <td style="text-align: right; font-size: 11px; padding: 7px 6px; border: 1px solid #cbd5e1;" class="font-mono">${formatRupiah(svc.unitPrice)}</td>
                <td style="text-align: right; font-weight: 700; font-size: 11px; padding: 7px 8px; border: 1px solid #cbd5e1; color: #4338ca;" class="font-mono">${formatRupiah(svc.total || (svc.qty * svc.unitPrice))}</td>
              </tr>
            `).join('')}
          ` : ''}
        </tbody>
      </table>

      <!-- KALKULASI FINANSIAL -->
      <div class="doc-totals" style="margin-bottom: 20px;">
        <div class="calc-summary" style="margin-left: auto; width: 340px;">
          ${mainItemsTotalVal > 0 && servicesTotalVal > 0 ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0;">
              <span class="text-muted">${isJasa ? 'Total Jasa Utama:' : 'Total Produk Utama:'}</span>
              <span class="font-mono">${formatRupiah(mainItemsTotalVal)}</span>
            </div>
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; color: #4338ca;">
              <span>Subtotal Jasa & Instalasi:</span>
              <span class="font-mono">+${formatRupiah(servicesTotalVal)}</span>
            </div>
          ` : ''}
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; font-weight: 600;">
            <span>${isJasa ? 'Total Jasa:' : 'Total Produk & Jasa:'}</span>
            <span class="font-mono">${formatRupiah(itemsTotalVal)}</span>
          </div>
          ${warrantyFeeVal > 0 ? `
            <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; color: #16a34a; font-weight: 600;">
              <span>+ Biaya Garansi (5%):</span>
              <span class="font-mono">+${formatRupiah(warrantyFeeVal)}</span>
            </div>
          ` : ''}
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0; font-weight: 700; border-top: 1px dashed #cbd5e1;">
            <span>${isJasa || warrantyFeeVal <= 0 ? 'Subtotal:' : 'Subtotal (Item + Garansi):'}</span>
            <span class="font-mono">${formatRupiah(quo.subtotal)}</span>
          </div>
          ${discountRow}
          <div class="calc-row" style="font-size: 11.5px; display: flex; justify-content: space-between; padding: 3px 0;">
            <span>PPN (${quo.taxRate || 11}%):</span>
            <span class="font-mono">${formatRupiah(quo.taxAmount)}</span>
          </div>
          <div class="calc-row total" style="border-top: 2px solid #0f172a; padding-top: 6px; font-size: 13.5px; display: flex; justify-content: space-between; font-weight: 700;">
            <span>Grand Total:</span>
            <span class="font-mono text-primary">${formatRupiah(quo.grandTotal)}</span>
          </div>
        </div>
      </div>

      <!-- KETENTUAN DAN GARANSI -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; margin-bottom: 24px; font-size: 11px; line-height: 1.55;">
        <div class="font-bold text-main" style="margin-bottom: 5px; font-size: 11.5px;">Syarat & Ketentuan Penawaran (Terms & Conditions):</div>
        <ol style="margin: 0; padding-left: 18px;">
          ${!isJasa && quo.warranty && quo.warranty !== '-' ? `<li><strong>Garansi Produk:</strong> ${escapeHtml(quo.warranty)}</li>` : ''}
          <li><strong>Waktu Penyerahan (Lead Time):</strong> ${escapeHtml(quo.leadTime || (isJasa ? 'Sesuai kesepakatan target milestone.' : 'Sesuai kesepakatan setelah PO diterima.'))}</li>
          <li><strong>Ketentuan Pembayaran:</strong> ${escapeHtml(quo.paymentTerms || 'DP 50%, Pelunasan sebelum barang diserahterimakan.')}</li>
          <li><strong>Masa Berlaku Penawaran:</strong> Penawaran harga ini berlaku hingga tanggal <strong>${quo.validUntil || '-'}</strong>.</li>
          ${cleanQuoNotes ? `<li><strong>Catatan Khusus:</strong> ${escapeHtml(cleanQuoNotes).replace(/\n/g, '<br>')}</li>` : ''}
        </ol>
      </div>

      <!-- TANDA TANGAN RESMI SURAT PENAWARAN (CALON PELANGGAN, KETUA UBM & DIREKTUR) -->
      ${(() => {
        const leaderDisplayName = compSettings.leaderName || 'Rizaldi Putra, M.Kom.';
        const leaderCleanName = leaderDisplayName.replace(/\.+$/, '');
        const directorDisplayName = compSettings.directorName || 'Dr. Eng. Tri Wahyudi, M.Eng.';
        const directorCleanName = directorDisplayName.replace(/\.+$/, '');

        const leaderVerifyUrl = (typeof getSignatureVerificationUrl === 'function')
          ? getSignatureVerificationUrl(leaderCleanName, compSettings.leaderRole || 'Ketua Unit Bisnis Mandiri (UBM)', quo.id, quo.projectName || quo.customerName || 'Surat Penawaran Resmi')
          : `${(typeof getVerificationBaseUrl === 'function' ? getVerificationBaseUrl() : window.location.origin)}/verify-approval?name=${encodeURIComponent(leaderCleanName)}&role=${encodeURIComponent(compSettings.leaderRole || 'Ketua Unit Bisnis Mandiri (UBM)')}&doc=${encodeURIComponent(quo.id)}&title=${encodeURIComponent(quo.projectName || quo.customerName || 'Surat Penawaran Resmi')}`;

        const directorVerifyUrl = (typeof getSignatureVerificationUrl === 'function')
          ? getSignatureVerificationUrl(directorCleanName, compSettings.directorRole || 'Direktur Politeknik Takumi', quo.id, quo.projectName || quo.customerName || 'Surat Penawaran Resmi')
          : `${(typeof getVerificationBaseUrl === 'function' ? getVerificationBaseUrl() : window.location.origin)}/verify-approval?name=${encodeURIComponent(directorCleanName)}&role=${encodeURIComponent(compSettings.directorRole || 'Direktur Politeknik Takumi')}&doc=${encodeURIComponent(quo.id)}&title=${encodeURIComponent(quo.projectName || quo.customerName || 'Surat Penawaran Resmi')}`;

        let ketuaSigHtml = '';
        if (!isDraft && quo.approvalKetuaUbm) {
          const qrSvg = (typeof generateQRCodeSvg === 'function')
            ? generateQRCodeSvg(leaderVerifyUrl, 2, 1)
            : `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(leaderVerifyUrl)}" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; display: block; margin: 0 auto;" alt="QR Code" />`;

          ketuaSigHtml = `
            <div style="height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 8px auto; text-align: center;">
              <a href="${leaderVerifyUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; margin: 0 auto;" title="Klik untuk membuka verifikasi tanda tangan: Approved by ${escapeAttr(leaderCleanName)}">
                <div style="width: 72px; height: 72px; max-width: 72px; max-height: 72px; box-sizing: border-box; overflow: hidden; padding: 4px; background: #ffffff; border: 1.5px solid #0f172a; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; margin: 0 auto; cursor: pointer;">
                  ${qrSvg}
                </div>
                <div style="font-size: 7.5px; color: #047857; font-weight: 700; margin-top: 4px; letter-spacing: 0.25px; text-transform: uppercase; text-align: center;">
                  ✓ TERVERIFIKASI DIGITAL
                </div>
              </a>
            </div>
          `;
        } else {
          ketuaSigHtml = `
            <div style="height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-style: italic; color: #64748b; font-size: 11px; margin: 8px auto; text-align: center;">
              <div style="border-bottom: 1px dashed #cbd5e1; width: 130px; margin-bottom: 6px;"></div>
              <span>(Tanda Tangan & Cap UBM)</span>
              <span style="font-size: 8.5px; color: ${isDraft ? '#64748b' : '#b45309'}; margin-top: 2px;">${isDraft ? '(Draft - Belum Diajukan)' : '(Menunggu Persetujuan Ketua UBM)'}</span>
            </div>
          `;
        }

        let directorSigHtml = '';
        if (!isDraft && quo.approvalDirektur) {
          const qrSvg = (typeof generateQRCodeSvg === 'function')
            ? generateQRCodeSvg(directorVerifyUrl, 2, 1)
            : `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(directorVerifyUrl)}" style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; display: block; margin: 0 auto;" alt="QR Code" />`;

          directorSigHtml = `
            <div style="height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 8px auto; text-align: center;">
              <a href="${directorVerifyUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; margin: 0 auto;" title="Klik untuk membuka verifikasi tanda tangan: Approved by ${escapeAttr(directorCleanName)}">
                <div style="width: 72px; height: 72px; max-width: 72px; max-height: 72px; box-sizing: border-box; overflow: hidden; padding: 4px; background: #ffffff; border: 1.5px solid #0f172a; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; margin: 0 auto; cursor: pointer;">
                  ${qrSvg}
                </div>
                <div style="font-size: 7.5px; color: #047857; font-weight: 700; margin-top: 4px; letter-spacing: 0.25px; text-transform: uppercase; text-align: center;">
                  ✓ TERVERIFIKASI DIGITAL
                </div>
              </a>
            </div>
          `;
        } else {
          directorSigHtml = `
            <div style="height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-style: italic; color: #64748b; font-size: 11px; margin: 8px auto; text-align: center;">
              <div style="border-bottom: 1px dashed #cbd5e1; width: 130px; margin-bottom: 6px;"></div>
              <span>(Tanda Tangan & Cap Institusi)</span>
              <span style="font-size: 8.5px; color: ${isDraft ? '#64748b' : '#b45309'}; margin-top: 2px;">${isDraft ? '(Draft - Belum Diajukan)' : '(Menunggu Persetujuan Direktur)'}</span>
            </div>
          `;
        }

        return `
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 22px; padding-top: 14px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 11px;">
            <!-- 1. CALON PELANGGAN (KIRI) -->
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
              <div style="font-weight: 700; color: #475569; font-size: 10px; text-transform: uppercase;">Disetujui Oleh (Calon Pelanggan),</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px; margin-bottom: 2px; min-height: 18px; letter-spacing: 1.5px;">.........................................</div>
              <div style="height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 8px auto; text-align: center;">
                <div style="border-bottom: 1px dashed #94a3b8; width: 130px; margin-bottom: 6px;"></div>
                <span style="font-style: italic; color: #94a3b8; font-size: 9.5px;">(Tanda Tangan & Cap Perusahaan)</span>
              </div>
              <div style="font-weight: bold; margin-top: 2px; font-size: 11px; ${quo.picName && String(quo.picName).trim() ? 'text-decoration: underline;' : ''}">
                ${quo.picName && String(quo.picName).trim() ? escapeHtml(String(quo.picName).trim()) : '( ..................................... )'}
              </div>
              <div class="text-muted" style="font-size: 9px; margin-top: 2px;">${quo.picName && String(quo.picName).trim() ? 'PIC / Kontak Person Pelanggan' : 'Tanda Tangan & Cap Perusahaan'}</div>
            </div>

            <!-- 2. KETUA UNIT BISNIS MANDIRI (TENGAH) -->
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
              <div style="font-weight: 700; color: #475569; font-size: 10px; text-transform: uppercase;">Hormat Kami,</div>
              <div style="font-weight: 700; font-size: 11px; color: #1e40af; margin-top: 2px; margin-bottom: 2px; min-height: 18px;">${escapeHtml(compSettings.leaderRole || 'Ketua Unit Bisnis Mandiri (UBM)')}</div>
              ${ketuaSigHtml}
              <div style="font-weight: bold; margin-top: 2px; font-size: 11px; text-decoration: underline;">
                ${escapeHtml(leaderDisplayName)}
              </div>
              <div class="text-muted" style="font-size: 9px; margin-top: 2px;">NIP. ${escapeHtml(compSettings.leaderNip || '-')}</div>
            </div>

            <!-- 3. DIREKTUR POLITEKNIK TAKUMI (KANAN) -->
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
              <div style="font-weight: 700; color: #475569; font-size: 10px; text-transform: uppercase;">Mengetahui & Menyetujui,</div>
              <div style="font-weight: 700; font-size: 11px; color: #9d174d; margin-top: 2px; margin-bottom: 2px; min-height: 18px;">${escapeHtml(compSettings.directorRole || 'Direktur Politeknik Takumi')}</div>
              ${directorSigHtml}
              <div style="font-weight: bold; margin-top: 2px; font-size: 11px; text-decoration: underline;">
                ${escapeHtml(directorDisplayName)}
              </div>
              <div class="text-muted" style="font-size: 9px; margin-top: 2px;">NIP. ${escapeHtml(compSettings.directorNip || '-')}</div>
            </div>
          </div>
        `;
      })()}
    </div>
  `;
}

function viewQuotationDetail(id) {
  const quo = (state.quotations || []).find(q => q.id === id);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }
  if (isQuotationDraft(quo) && !isQuotationVisibleToUser(quo)) {
    showToast('🔒 Draft Quotation ini bersifat privat dan hanya dapat dilihat oleh pembuat draft atau Administrator.', 'warning');
    return;
  }

  if (typeof ensureQuotationApprovalData === 'function') {
    ensureQuotationApprovalData(quo);
  }

  const content = document.getElementById('preview-modal-content');
  if (!content) return;

  const titleEl = document.getElementById('preview-modal-title');
  if (titleEl) {
    titleEl.innerHTML = `
      <span style="display: inline-flex; align-items: center; gap: 8px;">
        <i data-lucide="file-check-2" style="color: #2563eb;"></i>
        Surat Penawaran Resmi: <span class="mono-id">${quo.id}</span>
      </span>
    `;
  }

  const docHtml = buildQuotationPrintableHtml(quo);

  const existingOrder = (state.orders || []).find(o => o.quotationId === quo.id || (o.notes && o.notes.includes(quo.id)));
  const isConverted = !!existingOrder;
  const isDraft = isQuotationDraft(quo);
  const isRejected = quo.status === 'Rejected';

  const isKetuaApproved = !isDraft && Boolean(quo.approvalKetuaUbm);
  const isDirekturApproved = !isDraft && Boolean(quo.approvalDirektur);
  const isDualApproved = !isDraft && Boolean(isKetuaApproved && isDirekturApproved);
  const isKetuaRejected = isRejected && String(quo.approvalKetuaUbmBy || '').startsWith('Ditolak');
  const isDirekturRejected = isRejected && String(quo.approvalDirekturBy || '').startsWith('Ditolak');

  const activeUser = typeof getAuthUser === 'function' ? getAuthUser() : (typeof getLoggedInUser === 'function' ? getLoggedInUser() : null);
  const currentRole = typeof getNormalizedRole === 'function' ? getNormalizedRole(activeUser) : (activeUser?.role || '');
  const isAdmin = currentRole === 'Administrator';
  const isPPIC = currentRole === 'PPIC';
  const isKetuaUbm = currentRole === 'Ketua UBM';
  const isDirektur = currentRole === 'Direktur' || (currentRole.toLowerCase().includes('direktur') && !currentRole.toLowerCase().includes('wakil'));

  const statusBadgeClass = isDraft
    ? 'badge-secondary'
    : (quo.status === 'Accepted'
      ? 'badge-success'
      : (isRejected
        ? 'badge-danger'
        : (quo.status === 'Pengajuan' ? 'badge-amber' : 'badge-info')));
  const statusBadgeStyle = isDraft
    ? 'background: #e2e8f0; color: #334155; font-weight: 700;'
    : (isRejected
      ? 'background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; font-weight: 700;'
      : (quo.status === 'Pengajuan' ? 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700;' : ''));
  const statusDisplayText = isDraft
    ? '📝 Draft (Belum Terbit)'
    : (isRejected ? '❌ Rejected (Ditolak)' : quo.status);

  content.innerHTML = `
    <!-- STRIP AKSI INTERAKTIF MODAL (NO-PRINT) -->
    <div class="no-print" style="background: #f1f5f9; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span class="font-sm font-bold text-muted">Status:</span>
        <span class="badge ${statusBadgeClass}" style="${statusBadgeStyle}">${statusDisplayText}</span>
        
        ${isDraft ? `
          <span class="badge" style="font-size: 10.5px; padding: 2px 8px; font-weight: 600; background: #ffffff; color: #475569; border: 1px dashed #94a3b8; display: inline-flex; align-items: center; gap: 4px;" title="Draft hanya tersimpan di database dan tidak dikirim ke pimpinan">
            <i data-lucide="file-clock" style="width: 12px; height: 12px;"></i> Draft Lokal / Supabase (Belum dikirim ke Ketua UBM & Direktur)
          </span>
        ` : `
          <!-- Status Persetujuan Ketua UBM & Direktur -->
          <span class="badge ${isKetuaApproved ? 'badge-success' : (isKetuaRejected ? 'badge-danger' : 'badge-amber')}" style="font-size: 10.5px; padding: 2px 7px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Persetujuan Ketua UBM">
            <i data-lucide="${isKetuaApproved ? 'check-circle' : (isKetuaRejected ? 'x-circle' : 'clock')}" style="width: 12px; height: 12px;"></i> Ketua UBM: ${isKetuaApproved ? 'Disetujui' : (isKetuaRejected ? 'Ditolak' : 'Menunggu')}
          </span>
          <span class="badge ${isDirekturApproved ? 'badge-success' : (isDirekturRejected ? 'badge-danger' : 'badge-amber')}" style="font-size: 10.5px; padding: 2px 7px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Persetujuan Direktur">
            <i data-lucide="${isDirekturApproved ? 'check-circle' : (isDirekturRejected ? 'x-circle' : 'clock')}" style="width: 12px; height: 12px;"></i> Direktur: ${isDirekturApproved ? 'Disetujui' : (isDirekturRejected ? 'Ditolak' : 'Menunggu')}
          </span>
        `}

        ${isConverted ? `
          <span class="badge badge-success" style="font-size: 11px; padding: 2px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="check-check" style="width: 13px; height: 13px;"></i> Dikonversi ke Order #${existingOrder.id}
          </span>
        ` : ''}
      </div>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        ${(!isDraft && !isRejected && !isConverted && !isDirekturApproved && (isDirektur || isAdmin)) ? `
          <button type="button" class="btn btn-sm" style="background: #0284c7; color: #ffffff; border: none; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="Promise.resolve(approveQuotationByRole('${quo.id}', 'Direktur')).then(() => viewQuotationDetail('${quo.id}'))" title="Setujui penawaran ini sebagai Direktur">
            <i data-lucide="check" style="width: 12px; height: 12px;"></i> Setujui Direktur
          </button>
          <button type="button" class="btn btn-sm btn-outline text-danger" style="border-color: #fca5a5; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="Promise.resolve(rejectQuotationByRole('${quo.id}', 'Direktur')).then(() => closeModal('preview-modal'))" title="Tolak penawaran ini">
            <i data-lucide="x" style="width: 12px; height: 12px;"></i> Tolak
          </button>
        ` : ''}
        ${(!isDraft && !isRejected && !isConverted && !isKetuaApproved && (isKetuaUbm || isAdmin)) ? `
          <button type="button" class="btn btn-sm" style="background: #16a34a; color: #ffffff; border: none; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="Promise.resolve(approveQuotationByRole('${quo.id}', 'Ketua UBM')).then(() => viewQuotationDetail('${quo.id}'))" title="Setujui penawaran ini sebagai Ketua UBM">
            <i data-lucide="check" style="width: 12px; height: 12px;"></i> Setujui Ketua UBM
          </button>
          <button type="button" class="btn btn-sm btn-outline text-danger" style="border-color: #fca5a5; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" onclick="Promise.resolve(rejectQuotationByRole('${quo.id}', 'Ketua UBM')).then(() => closeModal('preview-modal'))" title="Tolak penawaran ini">
            <i data-lucide="x" style="width: 12px; height: 12px;"></i> Tolak
          </button>
        ` : ''}
        ${isPPIC ? `
          <span class="badge" style="font-size: 11px; padding: 4px 9px; background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4; font-weight: 700;">Mode Lihat (PPIC)</span>
        ` : (isDraft ? `
          <button type="button" class="btn btn-sm btn-primary" style="background: #16a34a; border-color: #16a34a; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="publishDraftQuotation('${quo.id}')" title="Terbitkan Draft ke Ketua UBM dan Direktur untuk persetujuan">
            <i data-lucide="send"></i> Terbitkan ke Pimpinan
          </button>
          <button type="button" class="btn btn-sm btn-outline" onclick="closeModal('preview-modal'); editQuotation('${quo.id}')">
            <i data-lucide="edit-3"></i> Edit Draft
          </button>
          <button type="button" class="btn btn-sm" style="background: #e2e8f0; color: #64748b; border: 1px solid #cbd5e1; cursor: not-allowed; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;" onclick="promptQuotationDualApprovalRequired('${quo.id}')" title="Quotation masih berstatus Draft">
            <i data-lucide="lock" style="width: 13px; height: 13px; color: #64748b;"></i> Draft Belum Terbit
          </button>
        ` : `
          <button type="button" class="btn btn-sm btn-outline" style="color: #16a34a; border-color: #86efac; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="shareQuotationWhatsApp('${quo.id}')">
            <i data-lucide="message-circle"></i> Share WhatsApp (PDF)
          </button>
          ${isConverted ? `
            <button type="button" class="btn btn-sm" style="background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; cursor: not-allowed; display: inline-flex; align-items: center; gap: 6px;" title="Quotation tidak dapat diedit karena sudah dikonversi ke Order Penjualan #${existingOrder.id}" onclick="showToast('Surat Penawaran #${quo.id} terkunci dan tidak dapat diedit karena sudah dikonversi ke Order Penjualan #${existingOrder.id}!', 'warning')">
              <i data-lucide="lock" style="width: 13px; height: 13px; color: #94a3b8;"></i> Edit Terkunci
            </button>
            <button type="button" class="btn btn-sm" style="background: #e2e8f0; color: #64748b; border: 1px solid #cbd5e1; cursor: not-allowed; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;" disabled title="Quotation ini sudah pernah dikonversi ke Order Penjualan #${existingOrder.id}">
              <i data-lucide="check-circle-2" style="color: #16a34a;"></i> Sudah Dikonversi
            </button>
          ` : (isDualApproved ? `
            <button type="button" class="btn btn-sm btn-outline" onclick="closeModal('preview-modal'); editQuotation('${quo.id}')">
              <i data-lucide="edit-3"></i> Edit
            </button>
            <button type="button" class="btn btn-sm btn-primary" style="background: #4f46e5; border-color: #4f46e5; display: inline-flex; align-items: center; gap: 6px;" onclick="closeModal('preview-modal'); convertQuotationToOrder('${quo.id}')">
              <i data-lucide="shopping-cart"></i> Konversi ke Order
            </button>
          ` : `
            <button type="button" class="btn btn-sm btn-outline" onclick="closeModal('preview-modal'); editQuotation('${quo.id}')">
              <i data-lucide="edit-3"></i> Edit
            </button>
            <button type="button" class="btn btn-sm" style="background: #f1f5f9; color: #94a3b8; border: 1px solid #cbd5e1; cursor: not-allowed; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;" onclick="promptQuotationDualApprovalRequired('${quo.id}')" title="Quotation belum dapat dikonversi ke Order Penjualan. Menunggu persetujuan lengkap dari Ketua UBM dan Direktur">
              <i data-lucide="lock" style="width: 13px; height: 13px; color: #94a3b8;"></i> Menunggu Persetujuan Lengkap
            </button>
          `)}
        `)}
      </div>
    </div>

    <!-- MAIN PRINTABLE DOCUMENT -->
    <div id="quotation-printable-area">
      ${docHtml}
    </div>
  `;

  const modalPrintBtn = document.getElementById('preview-modal-print-btn');
  if (modalPrintBtn) {
    if (isDraft) {
      modalPrintBtn.dataset.draftLocked = '1';
      modalPrintBtn.style.display = 'none';
      modalPrintBtn.disabled = true;
    } else {
      delete modalPrintBtn.dataset.draftLocked;
      modalPrintBtn.style.display = 'inline-flex';
      modalPrintBtn.disabled = false;
    }
  }

  openModal('preview-modal');
  if (window.lucide) lucide.createIcons();
}

function printQuotationPDF(id) {
  const quo = (state.quotations || []).find(q => q.id === id);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }
  if (isQuotationDraft(quo) && !isQuotationVisibleToUser(quo)) {
    showToast('🔒 Draft Quotation ini bersifat privat dan hanya dapat diakses oleh pembuat draft atau Administrator.', 'warning');
    return;
  }
  if (isQuotationDraft(quo)) {
    showToast(`📝 Quotation #${quo.id} masih berstatus Draft sehingga belum dapat dicetak. Klik Terbitkan terlebih dahulu!`, 'warning');
    return;
  }
  viewQuotationDetail(id);
  setTimeout(() => {
    if (typeof printCurrentDocument === 'function') {
      printCurrentDocument();
    } else {
      window.print();
    }
  }, 250);
}
window.printQuotationPDF = printQuotationPDF;

// -------------------------------------------------------------
// SHARE OTOMATIS KE WHATSAPP DALAM FORMAT PDF
// -------------------------------------------------------------
let activeQuotationShareData = null;
let activeQuotationPdfBlob = null;
let activeQuotationPdfFile = null;
let activeQuotationPdfUrl = '';

async function shareQuotationWhatsApp(id) {
  const quo = (state.quotations || []).find(q => q.id === id);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }
  if (isQuotationDraft(quo) && !isQuotationVisibleToUser(quo)) {
    showToast('🔒 Draft Quotation ini bersifat privat dan hanya dapat diakses oleh pembuat draft atau Administrator.', 'warning');
    return;
  }

  if (isQuotationDraft(quo)) {
    showToast(`📝 Quotation #${quo.id} masih berstatus Draft (Belum Terbit). Terbitkan terlebih dahulu sebelum dibagikan ke customer.`, 'warning');
    return;
  }

  const custLabel = (quo.customerName && quo.customerName !== 'Calon Pelanggan (Ditulis Tangan)')
    ? quo.customerName
    : 'Calon Customer';

  let phone = quo.customerPhone ? quo.customerPhone.trim() : '';

  // Prompt jika nomor telepon belum ada
  if (!phone) {
    const inputPhone = prompt(`Nomor WhatsApp customer "${custLabel}" belum tersimpan.\nMasukkan nomor WhatsApp (contoh: 081234567890):`);
    if (!inputPhone) return;
    phone = inputPhone.trim();
  }

  // Format sanitasi nomor telepon Indonesia (+62)
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  } else if (cleanPhone.startsWith('8')) {
    cleanPhone = '62' + cleanPhone;
  }

  activeQuotationShareData = { ...quo, cleanPhone, displayCustomerName: custLabel };

  // Buka modal share WhatsApp dengan status loading awal
  const modalBody = document.getElementById('wa-share-modal-body');
  if (modalBody) {
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 24px 10px;">
        <div class="loading-spinner" style="width: 38px; height: 38px; border: 3px solid #e2e8f0; border-top-color: #16a34a; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px auto;"></div>
        <h4 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">Menyiapkan Dokumen PDF Quotation...</h4>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Mengonversi surat penawaran resmi <strong>${quo.id}</strong> menjadi berkas PDF berkualitas tinggi.</p>
      </div>
    `;
    openModal('wa-share-modal');
  }

  try {
    // 1. Siapkan wrapper container dokumen resmi
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '790px';
    container.style.padding = '20px 24px';
    container.style.background = '#ffffff';
    container.style.boxSizing = 'border-box';
    container.innerHTML = buildQuotationPrintableHtml(quo);
    document.body.appendChild(container);

    let pdfFileUrl = quo.pdfUrl || '';
    let pdfBlob = null;

    // 2. Generate PDF via html2pdf
    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Quotation_${quo.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const worker = html2pdf().set(opt).from(container);
      pdfBlob = await worker.output('blob');
      const pdfBase64 = await worker.output('datauristring');

      // Simpan ke disk server UBM agar memiliki link download permanen
      try {
        const uploadRes = await fetch(`/api/quotations/${quo.id}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfBase64,
            filename: `Quotation_${quo.id}.pdf`
          })
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          pdfFileUrl = uploadData.fileUrl;
          quo.pdfUrl = pdfFileUrl;
        }
      } catch (errUpload) {
        console.warn('Gagal menyimpan file PDF ke server disk:', errUpload);
      }

      // Otomatis download file PDF ke komputer/perangkat
      if (pdfBlob) {
        activeQuotationPdfBlob = pdfBlob;
        activeQuotationPdfFile = new File([pdfBlob], `Quotation_${quo.id}.pdf`, { type: 'application/pdf' });
        activeQuotationPdfUrl = pdfFileUrl ? `${window.location.origin}${pdfFileUrl}` : `${window.location.origin}/uploads/quotations/Quotation_${quo.id}.pdf`;

        const downloadUrl = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `Quotation_${quo.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          window.URL.revokeObjectURL(downloadUrl);
        }, 1200);
      }
    }

    container.remove();

    const fullPdfLink = activeQuotationPdfUrl || `${window.location.origin}/uploads/quotations/Quotation_${quo.id}.pdf`;
    const canNativeFileShare = !!(activeQuotationPdfFile && navigator.canShare && navigator.canShare({ files: [activeQuotationPdfFile] }));

    // Tampilkan Konten Modal Siap Kirim PDF
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 18px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background: #dcfce7; color: #16a34a; margin-bottom: 8px;">
            <i data-lucide="check-circle" style="width: 28px; height: 28px;"></i>
          </div>
          <h4 style="font-size: 16px; font-weight: 700; margin: 0; color: #0f172a;">Dokumen PDF Siap Dikirim!</h4>
          <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 0 0;">
            Berkas <strong class="text-primary font-mono">Quotation_${quo.id}.pdf</strong> telah otomatis diunduh ke perangkat Anda.
          </p>
        </div>

        <!-- Kartu Metadata Dokumen -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #fee2e2; color: #e11d48; padding: 8px 10px; border-radius: 6px; font-weight: 800; font-size: 11.5px; display: flex; align-items: center; gap: 4px;">
              <i data-lucide="file-text" style="width: 14px; height: 14px;"></i> PDF
            </div>
            <div>
              <div style="font-weight: 700; font-size: 13px; color: #0f172a;">Quotation_${quo.id}.pdf</div>
              <div style="font-size: 11px; color: var(--text-muted);">
                Kepada: <strong>${escapeHtml(custLabel)}</strong> &bull; WA: <strong>${cleanPhone}</strong>
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-xs btn-outline" style="font-size: 11px;" onclick="downloadCurrentQuotationPdf()" title="Unduh Ulang Berkas PDF">
            <i data-lucide="download"></i> Unduh PDF
          </button>
        </div>

        <!-- Tombol Aksi Kirim -->
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;">
          ${canNativeFileShare ? `
          <button type="button" class="btn btn-primary" style="background: #16a34a; border-color: #16a34a; padding: 12px; font-size: 13.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="triggerNativeSharePDF()">
            <i data-lucide="share-2"></i> Kirim Berkas File PDF Langsung ke WhatsApp
          </button>
          ` : ''}

          <button type="button" class="btn btn-primary" style="background: #16a34a; border-color: #16a34a; padding: 12px; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="openWhatsAppChatWithPdfLink()">
            <i data-lucide="message-circle"></i> Buka WhatsApp Web & Kirim Dokumen PDF
          </button>

          <button type="button" class="btn btn-outline" style="padding: 9px; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="copyQuotationImageToClipboard()">
            <i data-lucide="copy"></i> Salin Gambar Dokumen (Bisa Langsung Paste / Ctrl+V di WhatsApp)
          </button>
        </div>

        <!-- Panduan Lampiran PDF di WhatsApp Web -->
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; font-size: 11.5px; color: #1e40af; line-height: 1.55;">
          <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <i data-lucide="info" style="width: 14px; height: 14px; flex-shrink: 0;"></i> Cara Mengirim Dokumen PDF di WhatsApp Web:
          </div>
          <ol style="margin: 0; padding-left: 18px;">
            <li>File <strong>Quotation_${quo.id}.pdf</strong> sudah otomatis terunduh di komputer Anda.</li>
            <li>Klik tombol <strong>"Buka WhatsApp Web"</strong> di atas.</li>
            <li>Di chat WhatsApp, cukup <strong>drag & drop (tarik) file PDF yang baru terunduh tersebut ke dalam chat</strong>, atau klik ikon klip kertas (📎) &rarr; Dokumen.</li>
            <li>Tautan unduh dokumen PDF resmi juga telah otomatis terisi pada pesan chat.</li>
          </ol>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }

  } catch (err) {
    console.error('Error in shareQuotationWhatsApp:', err);
    showToast('Gagal memproses berkas PDF untuk WhatsApp', 'error');
  }
}

// Handler: Download Berkas PDF yang aktif
function downloadCurrentQuotationPdf() {
  if (!activeQuotationPdfBlob || !activeQuotationShareData) {
    showToast('Berkas PDF belum siap', 'warning');
    return;
  }
  const downloadUrl = window.URL.createObjectURL(activeQuotationPdfBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `Quotation_${activeQuotationShareData.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }, 1000);
  showToast(`File Quotation_${activeQuotationShareData.id}.pdf diunduh!`, 'success');
}

// Handler: Native Share File PDF (Jika didukung OS/Browser)
async function triggerNativeSharePDF() {
  if (!activeQuotationPdfFile || !activeQuotationShareData) return;
  const quo = activeQuotationShareData;
  const fullPdfLink = activeQuotationPdfUrl || `${window.location.origin}/uploads/quotations/Quotation_${quo.id}.pdf`;

  const message = 
`*SURAT PENAWARAN HARGA RESMI (QUOTATION)*
*UNIT BISNIS MANDIRI (UBM) - POLITEKNIK TAKUMI*
--------------------------------------------------
Kepada Yth: *${quo.displayCustomerName || quo.customerName || 'Calon Customer'}*
${quo.picName ? `UP: ${quo.picName}\n` : ''}No. Penawaran : *${quo.id}*
Tanggal       : ${quo.quotationDate || '-'}
Masa Berlaku  : s/d ${quo.validUntil || '-'}
Grand Total   : *${formatRupiah(quo.grandTotal)}*
Garansi       : ${quo.warranty || (quo.quotationType === 'jasa' ? 'Garansi Pengerjaan' : '12 Bulan')}
Lead Time     : ${quo.leadTime || (quo.quotationType === 'jasa' ? '7-14 hari kerja' : '14 hari kerja')}
--------------------------------------------------
📄 *DOKUMEN FORMAT PDF RESMI TERLAMPIR*
Tautan file: ${fullPdfLink}
--------------------------------------------------
Terima kasih.
*Sales & Engineering Team UBM Takumi*`;

  try {
    await navigator.share({
      files: [activeQuotationPdfFile],
      title: `Quotation_${quo.id}.pdf`,
      text: message
    });
    showToast('✅ Berkas PDF berhasil dibagikan ke WhatsApp!', 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Native share gagal, membuka WhatsApp web:', err);
      openWhatsAppChatWithPdfLink();
    }
  }
}

// Handler: Buka Chat WhatsApp Web dengan Pesan Dokumen PDF
function openWhatsAppChatWithPdfLink() {
  if (!activeQuotationShareData) return;
  const quo = activeQuotationShareData;
  const fullPdfLink = activeQuotationPdfUrl || `${window.location.origin}/uploads/quotations/Quotation_${quo.id}.pdf`;

  const message = 
`*SURAT PENAWARAN HARGA RESMI (QUOTATION)*
*UNIT BISNIS MANDIRI (UBM) - POLITEKNIK TAKUMI*
--------------------------------------------------
Kepada Yth:
*${quo.displayCustomerName || quo.customerName || 'Calon Customer'}*
${quo.picName ? `UP: ${quo.picName}\n` : ''}${quo.customerAddress ? `Alamat: ${quo.customerAddress}\n` : ''}
No. Penawaran : *${quo.id}*
Tipe          : *${quo.quotationType === 'jasa' ? '🛠️ Jasa & Layanan Pekerjaan' : '📦 Produk Manufaktur'}*
Tanggal       : ${quo.quotationDate || '-'}
Masa Berlaku  : *s/d ${quo.validUntil || '-'}*
Grand Total   : *${formatRupiah(quo.grandTotal)}*
Garansi       : ${quo.warranty || (quo.quotationType === 'jasa' ? 'Garansi Pengerjaan' : '12 Bulan')}
Lead Time     : ${quo.leadTime || (quo.quotationType === 'jasa' ? '7-14 hari kerja' : '14 hari kerja')}
--------------------------------------------------
📄 *DOKUMEN RESMI FORMAT PDF:*
Silakan unduh atau buka berkas PDF resmi melalui tautan di bawah ini:
👉 ${fullPdfLink}
--------------------------------------------------

*(Berkas file PDF asli juga telah kami lampirkan/unduh ke komputer)*

Silakan konfirmasi jika penawaran harga ini telah disetujui. Terima kasih.

*Sales & Engineering Team UBM*
Politeknik Takumi
Web: ubm.takumi.ac.id`;

  // Pastikan file PDF juga terunduh
  downloadCurrentQuotationPdf();

  const waUrl = `https://wa.me/${quo.cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  showToast(`✅ WhatsApp Web terbuka! Silakan drag file PDF yang baru terunduh ke dalam chat.`, 'success');
}

// Handler: Salin Gambar Dokumen Penawaran ke Clipboard (Ctrl+V di WhatsApp)
async function copyQuotationImageToClipboard() {
  if (!activeQuotationShareData) return;
  const quo = activeQuotationShareData;

  showToast('⏳ Menyalin gambar dokumen penawaran ke clipboard...', 'info');

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '790px';
  container.style.padding = '20px 24px';
  container.style.background = '#ffffff';
  container.style.boxSizing = 'border-box';
  container.innerHTML = buildQuotationPrintableHtml(quo);
  document.body.appendChild(container);

  try {
    if (typeof html2canvas !== 'undefined') {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      container.remove();

      canvas.toBlob(async (blob) => {
        if (!blob) {
          showToast('Gagal membuat gambar dokumen', 'error');
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showToast('📋 Gambar Dokumen Quotation disalin! Buka WhatsApp Web lalu tekan Ctrl+V / Paste!', 'success');
        } catch (errClip) {
          console.warn('Clipboard write image error:', errClip);
          showToast('Browser membatasi penyalinan gambar otomatis. Gunakan file PDF yang telah terunduh.', 'warning');
        }
      }, 'image/png');
    } else {
      container.remove();
      showToast('Engine konversi gambar tidak tersedia', 'warning');
    }
  } catch (err) {
    container.remove();
    console.error('Error copying quotation image:', err);
    showToast('Gagal menyalin gambar dokumen', 'error');
  }
}

// -------------------------------------------------------------
// KONVERSI QUOTATION KE ORDER PENJUALAN
// -------------------------------------------------------------
function convertQuotationToOrder(id) {
  if (isQuotationReadOnlyForUser()) {
    showToast('⚠️ Role PPIC hanya memiliki akses melihat pada halaman Quotation.', 'warning');
    return;
  }
  const quo = (state.quotations || []).find(q => q.id === id);
  if (!quo) {
    showToast('Data penawaran tidak ditemukan!', 'error');
    return;
  }
  if (isQuotationDraft(quo) && !isQuotationVisibleToUser(quo)) {
    showToast('🔒 Draft Quotation ini hanya dapat diakses oleh pembuat draft atau Administrator.', 'warning');
    return;
  }

  if (isQuotationDraft(quo)) {
    showToast(`📝 Quotation #${quo.id} masih berstatus Draft (Belum Terbit) dan belum dikirim ke Ketua UBM & Direktur! Terbitkan & lengkapi persetujuan terlebih dahulu.`, 'warning');
    return;
  }

  // Validasi: Konversi ke order penjualan dari quotation hanya bisa dilakukan 1 kali saja
  const existingOrder = (state.orders || []).find(o => o.quotationId === quo.id || (o.notes && o.notes.includes(quo.id)));
  if (existingOrder) {
    showToast(`⚠️ Quotation ini sudah pernah dikonversi ke Order Penjualan #${existingOrder.id}! Tidak dapat dikonversi kembali.`, 'warning');
    return;
  }

  // Validasi: Dual Approval lengkap dari Ketua UBM dan Direktur wajib terpenuhi
  if (typeof ensureQuotationApprovalData === 'function') {
    ensureQuotationApprovalData(quo);
  }

  if (!quo.approvalKetuaUbm || !quo.approvalDirektur) {
    let missing = [];
    if (!quo.approvalKetuaUbm) missing.push('Ketua UBM');
    if (!quo.approvalDirektur) missing.push('Direktur');
    showToast(`⚠️ Quotation #${quo.id} belum dapat dikonversikan ke Order Penjualan!\nMembutuhkan persetujuan resmi dari: ${missing.join(' dan ')}.`, 'warning');
    return;
  }

  const isJasa = quo.quotationType === 'jasa';

  if (!confirm(`Konversi Quotation ${isJasa ? 'Jasa' : 'Produk'} "${quo.id}" menjadi Order Penjualan baru?`)) {
    return;
  }

  // Siapkan keterangan rincian jasa tambahan (non-BOM) jika ada
  let serviceNotes = '';
  if (quo.additionalServices && quo.additionalServices.length > 0) {
    serviceNotes = '\n\n[KETERANGAN JASA & INSTALASI (NON-BOM)]:\n' + 
      quo.additionalServices.map((s, idx) => `${idx + 1}. ${s.serviceName} (${s.qty} ${s.unit || 'Lot'} @ ${formatRupiah(s.unitPrice)}) = ${formatRupiah(s.total)}`).join('\n');
  }

  const cleanQuoNotes = getQuotationDisplayNotes(quo.notes);
  const orderCustomerName = (quo.customerName && quo.customerName !== 'Calon Pelanggan (Ditulis Tangan)') ? quo.customerName : '';

  // Siapkan data Order baru dari Quotation dengan status 'Pengajuan'
  // CATATAN: items HANYA berisi produk manufaktur utama (quo.items) agar BOM & Purchasing hanya memproses produk fisik
  const orderData = {
    quotationId: quo.id,
    orderType: quo.quotationType || 'produk',
    quotationType: quo.quotationType || 'produk',
    customerName: orderCustomerName,
    projectName: quo.projectName || (quo.items?.[0]?.itemName || ''),
    customerPhone: quo.customerPhone || '',
    customerAddress: quo.customerAddress || '',
    orderDate: new Date().toISOString().split('T')[0],
    dueDate: quo.validUntil || '',
    status: 'Pengajuan',
    notes: `Dikonversi dari Surat Penawaran Harga (${isJasa ? 'JASA' : 'PRODUK'}) #${quo.id}.\nKetentuan Garansi: ${quo.warranty || '-'}.\nLead time: ${quo.leadTime || '-'}.${serviceNotes}${cleanQuoNotes ? `\n\nCatatan Tambahan:\n${cleanQuoNotes}` : ''}`,
    items: (quo.items || []).map(it => ({ ...it })),
    additionalServices: quo.additionalServices || [],
    mainItemsTotal: quo.mainItemsTotal,
    servicesTotal: quo.servicesTotal,
    itemsTotal: quo.itemsTotal,
    warrantyFee: quo.warrantyFee,
    discount: quo.discount || 0,
    taxRate: quo.taxRate ?? 11,
    subtotal: quo.subtotal || 0,
    taxAmount: quo.taxAmount || 0,
    grandTotal: quo.grandTotal || 0
  };

  // Navigasi ke orders dan buka form modal terisi
  navigateTo('orders');
  setTimeout(() => {
    openOrderModal(orderData);
    showToast(`Status Quotation ${quo.id} otomatis menjadi "Pengajuan" & dimuat ke formulir Order!`, 'info');
  }, 150);
}
