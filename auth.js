// 在文件开头添加
window.appGlobals = window.appGlobals || {};

// 本地用户数据
const LOCAL_USERS = {
    '409653878@qq.com': {
        password: '123456',
        email: '409653878@qq.com',
        role: 'admin'
    }
};

// 登录处理
async function login(username, password) {
    const loginStatus = document.getElementById('loginStatus');
    loginStatus.textContent = '登录中...';
    
    try {
        // 检查本地用户
        const user = LOCAL_USERS[username];
        if (!user || user.password !== password) {
            throw new Error('用户名或密码错误');
        }

        // 登录成功
        showUserInfo(user.email);
        hideLoginForm();
        loginStatus.textContent = '';
        
        // 显示主界面
        document.querySelector('.container').style.display = 'block';
    } catch (error) {
        console.error('登录失败:', error);
        loginStatus.textContent = error.message;
        loginStatus.style.color = '#f44336';
    }
}

// 退出登录
function logout() {
    hideUserInfo();
    showLoginForm();
    clearLocalData();
}

// 数据同步
async function syncData() {
    try {
        // 从本地存储获取数据
        const localData = {
            products: JSON.parse(localStorage.getItem('products') || '{}'),
            orders: JSON.parse(localStorage.getItem('orders') || '{}'),
            lastSync: new Date().toISOString()
        };
        
        console.log('当前本地数据:', localData);
        return localData;
    } catch (error) {
        console.error('获取本地数据失败:', error);
    }
}

// 显示/隐藏登录表单和用户信息
function showLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const container = document.querySelector('.container');
    loginForm.style.display = 'block';
    container.style.display = 'none';
}

function hideLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const container = document.querySelector('.container');
    loginForm.style.display = 'none';
    container.style.display = 'block';
}

function showUserInfo(email) {
    const userInfo = document.getElementById('userInfo');
    const currentUser = document.getElementById('currentUser');
    currentUser.textContent = email;
    userInfo.style.display = 'flex';
}

function hideUserInfo() {
    document.getElementById('userInfo').style.display = 'none';
}

// 初始化登录表单事件监听
document.addEventListener('DOMContentLoaded', () => {
    const userLoginForm = document.getElementById('userLoginForm');
    if (userLoginForm) {
        userLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            login(username, password);
        });
    }
});

// 添加查看数据函数
function checkLocalData() {
    const data = {
        products: JSON.parse(localStorage.getItem('products') || '{}'),
        orders: JSON.parse(localStorage.getItem('orders') || '{}')
    };
    
    console.log('商品数据:', data.products);
    console.log('订单数据:', data.orders);
    
    // 显示统计信息
    const stats = {
        productsCount: Object.keys(data.products).length,
        ordersCount: Object.keys(data.orders).length
    };
    console.log('数据统计:', stats);
    
    return data;
} 

// 导出所有数据
function exportAllData() {
    const data = {
        products: JSON.parse(localStorage.getItem('products') || '{}'),
        orders: JSON.parse(localStorage.getItem('orders') || '{}'),
        exportTime: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 导入数据
async function importData(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // 更新本地存储
        if (data.products) localStorage.setItem('products', JSON.stringify(data.products));
        if (data.orders) localStorage.setItem('orders', JSON.stringify(data.orders));
        
        alert('数据导入成功！');
        location.reload(); // 刷新页面以显示新数据
    } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败: ' + error.message);
    }
}

// 显示数据统计
function showDataStats() {
    const data = checkLocalData();
    const stats = {
        productsCount: Object.keys(data.products).length,
        ordersCount: Object.keys(data.orders).length,
        lastUpdate: localStorage.getItem('lastUpdate') || '无'
    };

    alert(`数据统计：
商品数量：${stats.productsCount}
订单数量：${stats.ordersCount}
最后更新：${stats.lastUpdate}`);
}

// 添加文件导入监听
document.getElementById('importDataFile')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        importData(file);
    }
});