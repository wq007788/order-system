// 实时同步客户端
class SyncClient {
    constructor() {
        // 连接到同步服务器
        this.socket = io('http://你的服务器地址:3000');
        this.setupListeners();
        this.lastSyncTime = null;
        this.syncStatus = document.getElementById('syncStatus');
    }

    setupListeners() {
        // 连接成功
        this.socket.on('connect', () => {
            console.log('同步服务已连接');
            this.updateStatus('online');
            this.sendLocalData();
        });

        // 连接断开
        this.socket.on('disconnect', () => {
            console.log('同步服务已断开');
            this.updateStatus('offline');
        });

        // 接收数据更新
        this.socket.on('data_update', (data) => {
            console.log('收到数据更新:', data);
            this.updateLocalData(data);
        });

        // 监听本地存储变化
        window.addEventListener('storage', (e) => {
            if (e.key === 'products' || e.key === 'orders') {
                this.sendLocalData();
            }
        });
    }

    // 发送本地数据
    sendLocalData() {
        this.updateStatus('syncing');
        const data = {
            products: JSON.parse(localStorage.getItem('products') || '{}'),
            orders: JSON.parse(localStorage.getItem('orders') || '{}'),
            timestamp: new Date().toISOString()
        };
        this.socket.emit('sync_data', data);
    }

    // 更新本地数据
    updateLocalData(data) {
        this.updateStatus('syncing');
        if (data.products) {
            localStorage.setItem('products', JSON.stringify(data.products));
        }
        if (data.orders) {
            localStorage.setItem('orders', JSON.stringify(data.orders));
        }
        this.lastSyncTime = data.timestamp;
        localStorage.setItem('lastUpdate', this.lastSyncTime);
        
        // 刷新显示
        location.reload();
        this.updateStatus('online');
    }

    // 更新同步状态显示
    updateStatus(status) {
        if (!this.syncStatus) return;
        
        this.syncStatus.className = 'sync-status-indicator ' + status;
        const text = {
            'online': '已连接',
            'offline': '已断开',
            'syncing': '同步中...'
        }[status];
        
        this.syncStatus.querySelector('span').textContent = text;
    }
}

// 创建同步客户端实例
const syncClient = new SyncClient();
window.syncClient = syncClient; 