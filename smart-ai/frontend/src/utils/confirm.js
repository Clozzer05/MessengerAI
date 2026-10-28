// Hộp xác nhận theo giao diện app, thay cho window.confirm:
//   if (!(await confirmDialog({ title: 'Rời nhóm?', message: '...', confirmText: 'Rời nhóm', danger: true }))) return;
// ConfirmHost (gắn một lần trong App) hiển thị hộp và trả về true/false.
export function confirmDialog(options) {
    return new Promise((resolve) => {
        window.dispatchEvent(new CustomEvent('app:confirm', { detail: { ...options, resolve } }));
    });
}
