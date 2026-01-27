// notification.js - Reusable Notification System for SPA

class NotificationSystem {
    constructor() {
        this.createContainer();
        this.createModalContainer();
    }

    // Toast notifications container එක create කරනවා
    createContainer() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;
            document.body.appendChild(container);
        }
    }

    // Modal container එක create කරනවා
    createModalContainer() {
        if (!document.getElementById('modal-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;
            document.body.appendChild(overlay);
        }
    }

    // Toast notification (alert වලට වඩා)
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        toast.style.cssText = `
      background: ${colors[type] || colors.info};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      min-width: 250px;
      max-width: 400px;
      animation: slideIn 0.3s ease;
      font-family: Arial, sans-serif;
    `;

        toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span>${this.getIcon(type)}</span>
        <span>${message}</span>
      </div>
    `;

        container.appendChild(toast);

        // Auto remove කරනවා
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Confirm dialog (confirm() වලට වඩා)
    async confirm(message, title = 'Confirm', options = {}) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modal-overlay');

            const modal = document.createElement('div');
            modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
        animation: modalFadeIn 0.3s ease;
      `;

            modal.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 20px;">${title}</h3>
        <p style="margin: 0 0 24px 0; color: #6b7280; line-height: 1.5;">${message}</p>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button id="cancel-btn" style="
            padding: 10px 20px;
            border: 1px solid #d1d5db;
            background: white;
            color: #374151;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">${options.cancelText || 'Cancel'}</button>
          <button id="confirm-btn" style="
            padding: 10px 20px;
            border: none;
            background: ${options.confirmColor || '#3b82f6'};
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">${options.confirmText || 'Confirm'}</button>
        </div>
      `;

            overlay.innerHTML = '';
            overlay.appendChild(modal);
            overlay.style.display = 'flex';

            // Buttons වලට event listeners
            document.getElementById('cancel-btn').onclick = () => {
                this.closeModal();
                resolve(false);
            };

            document.getElementById('confirm-btn').onclick = () => {
                this.closeModal();
                resolve(true);
            };

            // Outside click කරොත් close කරනවා
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    this.closeModal();
                    resolve(false);
                }
            };
        });
    }

    // Alert dialog (alert() වලට වඩා)
    async alert(message, title = 'Alert', type = 'info') {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modal-overlay');

            const colors = {
                success: '#10b981',
                error: '#ef4444',
                warning: '#f59e0b',
                info: '#3b82f6'
            };

            const modal = document.createElement('div');
            modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
        animation: modalFadeIn 0.3s ease;
      `;

            modal.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <span style="font-size: 24px;">${this.getIcon(type)}</span>
          <h3 style="margin: 0; color: #1f2937; font-size: 20px;">${title}</h3>
        </div>
        <p style="margin: 0 0 24px 0; color: #6b7280; line-height: 1.5;">${message}</p>
        <div style="display: flex; justify-content: flex-end;">
          <button id="ok-btn" style="
            padding: 10px 20px;
            border: none;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">OK</button>
        </div>
      `;

            overlay.innerHTML = '';
            overlay.appendChild(modal);
            overlay.style.display = 'flex';

            document.getElementById('ok-btn').onclick = () => {
                this.closeModal();
                resolve(true);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    this.closeModal();
                    resolve(true);
                }
            };
        });
    }

    // Modal close කරනවා
    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = 'none';
    }

    // Icons type එක අනුව
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }
}

// CSS Animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  @keyframes modalFadeIn {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  #toast-container button,
  #modal-overlay button {
    transition: all 0.2s ease;
  }

  #toast-container button:hover,
  #modal-overlay button:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;
document.head.appendChild(style);

// Global instance එකක් create කරනවා
const notify = new NotificationSystem();

// Usage examples:
/*

// Toast messages (non-blocking)
notify.toast('Employee එක successfully add කරා!', 'success');
notify.toast('Error occurred!', 'error');
notify.toast('Please fill all fields', 'warning');

// Confirm dialog
const result = await notify.confirm(
  'මේ employee එක delete කරන්න ඔනේද?',
  'Delete Employee',
  {
    confirmText: 'Delete',
    cancelText: 'Cancel',
    confirmColor: '#ef4444'
  }
);
if (result) {
  // User confirmed
  deleteEmployee();
}

// Alert dialog
await notify.alert(
  'Customer එක successfully save වුනා!',
  'Success',
  'success'
);

*/