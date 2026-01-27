class NotificationSystem {
    constructor() {
        // අනුපිළිවෙල සහ scope එක තහවුරු කිරීමට
        this.init();
    }

    init = () => {
        this.createContainer();
        this.createModalContainer();
        this.injectStyles();
    }

    createContainer = () => {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed; top: 20px; right: 20px; 
                z-index: 9999; display: flex; 
                flex-direction: column; gap: 10px;
            `;
            document.body.appendChild(container);
        }
    }

    createModalContainer = () => {
        if (!document.getElementById('modal-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0, 0, 0, 0.5); display: none; 
                justify-content: center; align-items: center; z-index: 10000;
            `;
            document.body.appendChild(overlay);
        }
    }

    // Modal එක close කිරීම
    closeModal = () => {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    // Alert Dialog
    alert = async (message, title = 'Alert', type = 'info', options = {}) => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modal-overlay');
            const allowOutsideClick = options.allowOutsideClick !== false;
            const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white; border-radius: 12px; padding: 24px; 
                max-width: 400px; width: 90%; box-shadow: 0 20px 25px rgba(0,0,0,0.15); 
                animation: modalFadeIn 0.3s ease; font-family: sans-serif;
            `;

            modal.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="font-size: 24px;">${this.getIcon(type)}</span>
                    <h3 style="margin: 0; color: #1f2937;">${title}</h3>
                </div>
                <p style="margin: 0 0 24px 0; color: #4b5563; line-height: 1.5;">${message}</p>
                <div style="display: flex; justify-content: flex-end;">
                    <button id="ok-btn" style="padding: 10px 20px; border: none; background: ${colors[type]}; color: white; border-radius: 6px; cursor: pointer;">OK</button>
                </div>`;

            overlay.innerHTML = '';
            overlay.appendChild(modal);
            overlay.style.display = 'flex';

            document.getElementById('ok-btn').onclick = () => {
                this.closeModal();
                resolve(true);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay && allowOutsideClick) {
                    this.closeModal();
                    resolve(true);
                }
            };
        });
    }

    // Confirm Dialog
    confirm = async (message, title = 'Confirm', options = {}) => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('modal-overlay');
            const allowOutsideClick = options.allowOutsideClick !== false;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: white; border-radius: 12px; padding: 24px; 
                max-width: 400px; width: 90%; box-shadow: 0 20px 25px rgba(0,0,0,0.15); 
                animation: modalFadeIn 0.3s ease; font-family: sans-serif;
            `;

            modal.innerHTML = `
                <h3 style="margin: 0 0 16px 0; color: #1f2937;">${title}</h3>
                <p style="margin: 0 0 24px 0; color: #4b5563; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancel-btn" style="padding: 10px 20px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer;">${options.cancelText || 'Cancel'}</button>
                    <button id="confirm-btn" style="padding: 10px 20px; border: none; background: ${options.confirmColor || '#3b82f6'}; color: white; border-radius: 6px; cursor: pointer;">${options.confirmText || 'Confirm'}</button>
                </div>`;

            overlay.innerHTML = '';
            overlay.appendChild(modal);
            overlay.style.display = 'flex';

            document.getElementById('cancel-btn').onclick = () => {
                this.closeModal();
                resolve(false);
            };

            document.getElementById('confirm-btn').onclick = () => {
                this.closeModal();
                resolve(true);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay && allowOutsideClick) {
                    this.closeModal();
                    resolve(false);
                }
            };
        });
    }

    toast = (message, type = 'info', duration = 3000) => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };

        toast.style.cssText = `
            background: ${colors[type]}; color: white; padding: 12px 20px; 
            border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
            animation: slideIn 0.3s ease;
        `;
        toast.innerHTML = `<span>${this.getIcon(type)} ${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    getIcon = (type) => {
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        return icons[type] || 'ℹ';
    }

    injectStyles = () => {
        if (!document.getElementById('notify-styles')) {
            const style = document.createElement('style');
            style.id = 'notify-styles';
            style.textContent = `
                @keyframes modalFadeIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
            `;
            document.head.appendChild(style);
        }
    }
}

// Global instance
const notify = new NotificationSystem();