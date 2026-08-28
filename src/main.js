// 開機組裝：接線、全域橋、初始化
import * as store from './store.js?v=21';
import * as cloud from './cloud.js?v=21';
import * as ui from './ui.js?v=21';

// 1) 載入本機資料
const dataWasCorrupted = store.load();

// 2) 相依接線（store 存檔 → 雲端推送；雲端事件 → UI 提示/重繪）
store.setOnSave(cloud.schedulePush);
store.setOnSaveError(() => ui.toast('⚠ 儲存失敗，請檢查瀏覽器空間或隱私模式設定'));
cloud.hooks.toast = ui.toast;
cloud.hooks.render = ui.render;

// 3) 內聯 onclick 的全域橋（HTML 樣板以 app.* 呼叫）
window.app = {
  openAdminUsersSheet: ui.openAdminUsersSheet,
  adminDeleteUser: ui.adminDeleteUser,
  adminRenameProject: ui.adminRenameProject,
  adminDeleteCloudProject: ui.adminDeleteCloudProject,
  copySettlement: ui.copySettlement,
  settleTransfer: ui.settleTransfer,
  openCatEditSheet: ui.openCatEditSheet,
  saveCatEdit: ui.saveCatEdit,
  updateExactSum: ui.updateExactSum,
  openProfileSheet: ui.openProfileSheet,
  pickAvatar: ui.pickAvatar,
  saveProfile: ui.saveProfile,
  adminToggleAdmin: ui.adminToggleAdmin,
  openMemberEditSheet: ui.openMemberEditSheet,
  pickMemberAvatar: ui.pickMemberAvatar,
  clearMemberAvatar: ui.clearMemberAvatar,
  saveMemberEdit: ui.saveMemberEdit,
  switchTab: ui.switchTab,
  selectProjType: ui.selectProjType,
  selectMode: ui.selectMode,
  selectReveal: ui.selectReveal,
  selectKind: ui.selectKind,
  revealRandom: ui.revealRandom,
  openEditSheet: ui.openEditSheet,
  focusCell: ui.focusCell,
  delMember: ui.delMember,
  delExpense: ui.delExpense,
  closeSheet: ui.closeSheet,
  switchProject: ui.switchProject,
  selectCat: ui.selectCat,
  renameProject: ui.renameProject,
  openSheet: ui.openSheet,
  openProjectSheet: ui.openProjectSheet,
  openMemberSheet: ui.openMemberSheet,
  openCatSheet: ui.openCatSheet,
  openAuthSheet: ui.openAuthSheet,
  openAdminSheet: ui.openAdminSheet,
  markSettled: ui.markSettled,
  manualRefresh: ui.manualRefresh,
  kp: ui.kp,
  joinProject: ui.joinProject,
  joinByCode: ui.joinByCode,
  fillEqualSpend: ui.fillEqualSpend,
  doSignup: ui.doSignup,
  doLogout: ui.doLogout,
  doLogin: ui.doLogin,
  delProject: ui.delProject,
  delCat: ui.delCat,
  cloudAction: ui.cloudAction,
  changeNick: ui.changeNick,
  addProject: ui.addProject,
  addMember: ui.addMember,
  addLedgerRecord: ui.addLedgerRecord,
  addExpense: ui.addExpense,
  addChat: ui.addChat,
  addCat: ui.addCat,
  openDateSheet: ui.openDateSheet,
  renderDateResults: ui.renderDateResults,
};

// 4) 首次渲染
ui.render();
ui.initSheetGestures(); // 表單下滑關閉
if (dataWasCorrupted) ui.toast('⚠ 偵測到本機資料損毀，已重置為預設資料');

// 5) 雲端同步與登入
if (cloud.cloudOn()) {
  setInterval(cloud.pullAll, 20000);           // poll every 20s (pullAll skips when tab is hidden)
  window.addEventListener('focus', cloud.pullAll); // sync immediately on window focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') cloud.pullAll(); // resume instantly when tab becomes visible
  });
  cloud.pullAll();
  cloud.initAuth();
}
