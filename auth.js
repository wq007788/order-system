// 在文件开头添加
window.appGlobals = window.appGlobals || {};

// 使用 Firebase 进行认证和数据同步
if (!window.appGlobals.firebaseInitialized) {
    const firebaseConfig = {
        apiKey: "AIzaSyBdii705IyN5vGZnsVA1XH-cFquoIqItL8",
        authDomain: "product-management-syste-f9c27.firebaseapp.com",
        projectId: "product-management-syste-f9c27",
        storageBucket: "product-management-syste-f9c27.firebasestorage.app",
        messagingSenderId: "842647773016",
        appId: "1:842647773016:web:b7b3e04f9266dcc72e8f2d",
        measurementId: "G-SEGBM5Y5LL"
    };

    // 初始化 Firebase 并导出到全局变量
    try {
        const app = firebase.initializeApp(firebaseConfig);
        console.log('Firebase 初始化成功');
        window.appGlobals.auth = firebase.auth();
        window.appGlobals.db = firebase.firestore();
        window.appGlobals.firebaseInitialized = true;
        console.log('Auth 和 Firestore 初始化成功');
    } catch (error) {
        console.error('Firebase 初始化失败:', error);
    }
}

// 使用全局变量
const { auth, db } = window.appGlobals;

// 等待 DOM 加载完成后再添加事件监听和检查登录状态
document.addEventListener('DOMContentLoaded', () => {
    // 初始化登录表单事件监听
    const userLoginForm = document.getElementById('userLoginForm');
    if (userLoginForm) {
        userLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('表单提交');
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            console.log('获取到的用户名和密码:', username, password.length);
            login(username, password);
        });
    }

    // 检查登录状态
    if (auth) {
        auth.onAuthStateChanged((user) => {
            const container = document.querySelector('.container');
            if (user) {
                showUserInfo(user.email);
                hideLoginForm();
                container.style.display = 'block';
                syncData();
            } else {
                hideUserInfo();
                showLoginForm();
                container.style.display = 'none';
            }
        });
    } else {
        console.error('Auth 未初始化');
    }
});

// 登录处理
async function login(username, password) {
    const loginStatus = document.getElementById('loginStatus');
    loginStatus.textContent = '登录中...';
    
    try {
        console.log('尝试登录:', username);
        // 添加网络超时处理
        const loginPromise = auth.signInWithEmailAndPassword(username, password);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('登录超时，请检查网络连接')), 10000)
        );
        
        const userCredential = await Promise.race([loginPromise, timeoutPromise]);
        console.log('登录成功:', userCredential);
        
        const user = userCredential.user;
        showUserInfo(user.email);
        hideLoginForm();
        syncData();
        loginStatus.textContent = '';
    } catch (error) {
        console.error('登录失败:', error.code, error.message);
        let errorMessage = '登录失败';
        
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = '邮箱格式不正确';
                break;
            case 'auth/user-not-found':
                errorMessage = '用户不存在';
                break;
            case 'auth/wrong-password':
                errorMessage = '密码错误';
                break;
            case 'auth/network-request-failed':
                errorMessage = '网络连接失败，请检查网络后重试';
                break;
            default:
                errorMessage = error.message;
        }
        
        loginStatus.textContent = errorMessage;
        loginStatus.style.color = '#f44336';
    }
}

// 退出登录
function logout() {
    auth.signOut().then(() => {
        hideUserInfo();
        showLoginForm();
        clearLocalData();
    }).catch((error) => {
        alert('退出失败: ' + error.message);
    });
}

// 数据同步
async function syncData() {
    const user = auth.currentUser;
    if (!user) return;

    // 同步本地数据到云端
    const localData = getAllLocalData();
    await db.collection('users').doc(user.uid).set({
        products: localData.products || {},
        orders: localData.orders || {},
        lastSync: new Date()
    });

    // 监听云端数据变化
    db.collection('users').doc(user.uid)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                updateLocalData(data);
                refreshDisplay();
            }
        });
}

// 显示/隐藏登录表单和用户信息
function showLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const container = document.querySelector('.container');
    const loginStatus = document.getElementById('loginStatus');
    loginForm.style.display = 'block';
    container.style.display = 'none';
    loginStatus.textContent = '';
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

// 修改初始化登录表单事件监听
document.addEventListener('DOMContentLoaded', () => {
    const userLoginForm = document.getElementById('userLoginForm');
    if (userLoginForm) {
        userLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('表单提交');
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            console.log('获取到的用户名和密码:', username, password.length);
            login(username, password);
        });
    }
});

// 修改检查登录状态
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged((user) => {
        const container = document.querySelector('.container');
        if (user) {
            showUserInfo(user.email);
            hideLoginForm();
            container.style.display = 'block';
            syncData();
        } else {
            hideUserInfo();
            showLoginForm();
            container.style.display = 'none';
        }
    });
}); 