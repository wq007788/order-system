// 图片上传相关函数
function initializeImageUpload() {
    const fileInput = document.getElementById('fileInput');
    const progressBar = document.querySelector('.progress-bar');
    const progress = document.querySelector('.progress');

    fileInput.addEventListener('change', handleImageUpload);
}

// 优化的图片压缩函数
async function compressImage(file, targetSize = 200) { // targetSize in KB
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = async function() {
                try {
                    const compressedDataUrl = await smartCompress(img, file.size, targetSize * 1024);
                    console.log(`压缩前: ${Math.round(file.size / 1024)}KB, 压缩后: ${Math.round(compressedDataUrl.length / 1.37 / 1024)}KB`);
                    resolve(compressedDataUrl);
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// 优化智能压缩函数
async function smartCompress(img, originalSize, targetSize) {
    // 初始化参数
    let maxWidth = img.width;
    let maxHeight = img.height;
    let quality = 0.9;
    
    // 如果原始尺寸太大，先进行尺寸压缩
    const maxDimension = Math.min(2048, Math.max(maxWidth, maxHeight)); // 根据原始尺寸动态调整
    if (maxWidth > maxDimension || maxHeight > maxDimension) {
        const ratio = Math.min(maxDimension / maxWidth, maxDimension / maxHeight);
        maxWidth = Math.round(maxWidth * ratio);
        maxHeight = Math.round(maxHeight * ratio);
    }

    // 使用 createImageBitmap 优化性能
    const imageBitmap = await createImageBitmap(img);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 使用二分法查找最佳质量参数
    let minQuality = 0.1;
    let maxQuality = 1;
    let bestDataUrl = null;
    let bestSize = Infinity;
    let attempts = 0;
    const maxAttempts = 8;

    while (attempts < maxAttempts) {
        quality = (minQuality + maxQuality) / 2;
        
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageBitmap, 0, 0, maxWidth, maxHeight);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const currentSize = dataUrl.length / 1.37;

        if (Math.abs(currentSize - targetSize) < Math.abs(bestSize - targetSize)) {
            bestDataUrl = dataUrl;
            bestSize = currentSize;
        }

        if (currentSize > targetSize) {
            maxQuality = quality;
        } else {
            minQuality = quality;
        }

        if (Math.abs(currentSize - targetSize) / targetSize < 0.1) {
            break;
        }

        attempts++;
    }

    imageBitmap.close(); // 释放资源
    return bestDataUrl;
}

// 修改handleImageUpload函数
async function handleImageUpload(event) {
    console.log('开始处理图片上传...');
    const files = event.target.files;
    console.log('选择的文件:', files);
    
    if (!files.length) {
        console.log('没有选择文件');
        return;
    }

    const progressBar = document.querySelector('.progress-bar');
    const progress = document.querySelector('.progress');
    progressBar.style.display = 'block';

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log('处理文件:', file.name);
            
            if (!file.type.startsWith('image/')) {
                console.log('不是图片文件:', file.type);
                continue;
            }

            const code = file.name.split('.')[0];
            console.log('商品编码:', code);

            try {
                // 压缩图片
                const targetSize = file.size > 1024 * 1024 ? 200 : 100;
                console.log('开始压缩图片...');
                const compressedImageUrl = await compressImage(file, targetSize);
                console.log('图片压缩完成');

                // 更新进度
                const percent = ((i + 1) / files.length) * 100;
                progress.style.width = percent + '%';

                // 保存到 IndexedDB
                await saveImageToDB(code, compressedImageUrl);
                console.log('图片保存成功');

                // 更新显示
                await updateImageGrid();
                console.log('图片网格更新完成');
            } catch (err) {
                console.error('处理单个文件时出错:', err);
                alert(`处理文件 ${file.name} 时出错: ${err.message}`);
            }
        }
    } catch (error) {
        console.error('图片上传失败:', error);
        alert('图片上传失败，请重试: ' + error.message);
    } finally {
        progressBar.style.display = 'none';
        progress.style.width = '0%';
        event.target.value = '';
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        console.log('创建FileReader...');
        const reader = new FileReader();
        
        reader.onload = () => {
            console.log('FileReader加载完成');
            resolve(reader.result);
        };
        
        reader.onerror = (error) => {
            console.error('FileReader错误:', error);
            reject(new Error('读取文件失败'));
        };
        
        try {
            reader.readAsDataURL(file);
            console.log('开始读取文件...');
        } catch (error) {
            console.error('调用readAsDataURL时出错:', error);
            reject(error);
        }
    });
}

function saveImageData(code, imageUrl) {
    try {
        console.log('开始保存图片数据...');
        let imageData = {};
        
        try {
            const stored = localStorage.getItem('imageData');
            if (stored) {
                imageData = JSON.parse(stored);
            }
        } catch (error) {
            console.error('解析已存储的imageData失败:', error);
            imageData = {};
        }

        imageData[code] = {
            url: imageUrl,
            timestamp: new Date().toISOString(),
            code: code
        };

        try {
            localStorage.setItem('imageData', JSON.stringify(imageData));
            console.log('图片数据保存成功');
        } catch (error) {
            console.error('保存到localStorage失败:', error);
            if (error.name === 'QuotaExceededError') {
                alert('存储空间已满，请清理一些数据后重试');
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('保存图片数据时出错:', error);
        throw error;
    }
}

// 添加 IndexedDB 数
const DB_NAME = 'ImageLibraryDB';
const DB_VERSION = 1;
let db;

// 修改数据库初始化函数
function initDB() {
    return new Promise((resolve, reject) => {
        try {
            // 直接打开数据库，不删除旧数据
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error('数据库打开失败:', event.target.error);
                reject(new Error('数据库打开失败，请刷新页面重试'));
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('数据库打开成功');
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // 只在数据库不存在时创建存储
                if (!db.objectStoreNames.contains('images')) {
                    const imageStore = db.createObjectStore('images', { keyPath: 'id' });
                    imageStore.createIndex('code', 'code', { unique: false });
                    imageStore.createIndex('supplier', 'supplier', { unique: false });
                    imageStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('数据库结构创建成功');
                }
            };
        } catch (error) {
            console.error('数据库初始化错误:', error);
            reject(error);
        }
    });
}

// 保存图片到 IndexedDB
async function saveImageToDB(code, imageUrl, supplier = '') {
    await ensureDBConnection();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            
            // 使用编码和供应商组合作为唯一标识
            const uniqueId = `${code}_${supplier}`;
            
            const imageData = {
                id: uniqueId,
                code: code,
                supplier: supplier,
                file: imageUrl,
                timestamp: new Date().toISOString()
            };
            
            const request = store.put(imageData);
            
            request.onsuccess = () => {
                console.log('图片保存到 IndexedDB 成功');
                resolve();
            };
            
            request.onerror = () => {
                console.error('保存到 IndexedDB 失败:', request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error('创建事务失败:', error);
            reject(error);
        }
    });
}

// 从 IndexedDB 获取图片
async function getImageFromDB(code, supplier) {
    await ensureDBConnection();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            // 使用组合ID查询
            const uniqueId = `${code}_${supplier}`;
            console.log('正在查询图片:', uniqueId);
            
            const request = store.get(uniqueId);
            
            request.onsuccess = () => {
                const result = request.result;
                console.log('查询结果:', result);
                resolve(result);
            };
            
            request.onerror = (error) => {
                console.error('查询图片失败:', error);
                reject(error);
            };
        } catch (error) {
            console.error('获取图片事务失败:', error);
            reject(error);
        }
    });
}

// 修改 updateImageGrid 函数
async function updateImageGrid() {
    await ensureDBConnection();
    const imageGrid = document.getElementById('imageGrid');
    const productData = JSON.parse(localStorage.getItem('productData') || '{}');
    
    // 使用 DocumentFragment 减少DOM操作
    const fragment = document.createDocumentFragment();
    const supplierGroups = {};

    try {
        const transaction = db.transaction(['images'], 'readonly');
        const store = transaction.objectStore('images');
        const images = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        // 使用 Map 优化查找性能
        const productMap = new Map(Object.entries(productData));

        images.forEach(image => {
            const uniqueId = `${image.code}_${image.supplier}`;
            const product = productMap.get(uniqueId) || {};
            const supplier = product.supplier || '未分类';
            
            if (!supplierGroups[supplier]) {
                supplierGroups[supplier] = [];
            }
            
            supplierGroups[supplier].push({...image, ...product});
        });

        Object.entries(supplierGroups).forEach(([supplier, images]) => {
            const supplierGroup = document.createElement('div');
            supplierGroup.className = 'supplier-group';
            supplierGroup.setAttribute('data-supplier', supplier);
            
            // 使用模板字符串优化HTML生成
            supplierGroup.innerHTML = `
                <div class="supplier-title">
                    <div class="supplier-title-left">
                        <span>${supplier}</span>
                        <span class="count">${images.length}个商品</span>
                    </div>
                    <button class="add-new-btn" onclick="openNewItemForm('${supplier}')">添加新款</button>
                </div>
                <div class="supplier-images"></div>
            `;
            
            const imagesDiv = supplierGroup.querySelector('.supplier-images');
            images.forEach(image => {
                imagesDiv.appendChild(createImageItem(image));
            });
            
            fragment.appendChild(supplierGroup);
        });

        imageGrid.innerHTML = '';
        imageGrid.appendChild(fragment);
        
        const savedColumns = localStorage.getItem('gridColumns') || 6;
        updateGridColumns(savedColumns);

        // 添加这一行，更新供应商导航
        updateSupplierNav();
        
    } catch (error) {
        console.error('更新图片网格失败:', error);
        alert('更新图片网格失败，请刷新页面重试');
    }
}

// 修改商品点击事件处理函数
function createImageItem(image) {
    const div = document.createElement('div');
    div.className = 'image-item';
    
    const uniqueId = `${image.code}_${image.supplier}`;
    const productData = JSON.parse(localStorage.getItem('productData') || '{}');
    const product = productData[uniqueId] || {};
    
    div.innerHTML = `
        <div class="select-overlay ${selectedItems.has(uniqueId) ? 'selected' : ''}" onclick="toggleSelectItem('${uniqueId}')">
            <div class="checkbox">${selectedItems.has(uniqueId) ? '✓' : ''}</div>
        </div>
        <img src="${image.file}" alt="${image.code}">
        <div class="info">
            <p><span>编码</span><span class="clickable" onclick="event.stopPropagation(); showPriceCompare('${image.code}')">${image.code}</span></p>
            <p><span>名称</span><span>${product.name || '-'}</span></p>
            <p class="sensitive-info"><span>供应商</span><span>${product.supplier || '-'}</span></p>
            <p class="sensitive-info"><span>成本</span><span>${product.cost || '-'}</span></p>
            <p><span>单价</span><span>${product.price || '-'}</span></p>
            <p><span>尺码</span><span>${product.size || '-'}</span></p>
        </div>
    `;
    
    // 添加整个商品项的点击事件
    div.addEventListener('click', () => {
        // 合并图片和商品数据
        const fullProduct = {
            code: image.code,
            supplier: image.supplier,
            name: product.name || '',
            cost: product.cost || '',
            price: product.price || '',
            size: product.size || ''
        };
        openOrderForm(fullProduct);
    });
    
    return div;
}

// 同样修改批量上传函数
async function handleBatchImageUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    const progressBar = document.querySelector('.progress-bar');
    const progress = document.querySelector('.progress');
    progressBar.style.display = 'block';

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            const code = file.name.split('.')[0];
            
            // 压缩图片
            const compressedImageUrl = await compressImage(file);
            
            const percent = ((i + 1) / files.length) * 100;
            progress.style.width = percent + '%';

            saveImageData(code, compressedImageUrl);
        }
        updateImageGrid();
    } catch (error) {
        console.error('批量上传失败:', error);
        alert('批量���传失败，请重试');
    } finally {
        progressBar.style.display = 'none';
        progress.style.width = '0%';
        event.target.value = '';
    }
}

// 修改打开编辑表单函数
function openEditForm(code) {
    const editForm = document.getElementById('editForm');
    const overlay = document.getElementById('overlay');
    const productData = JSON.parse(localStorage.getItem('productData') || '{}');

    // 如果已经被移动过，保持当前位置
    if (!editForm.hasAttribute('data-moved')) {
        editForm.style.transform = 'translate(-50%, -50%)';
    }

    // 显示表单,但不改变背景
    editForm.classList.add('active');
    overlay.classList.add('active');
    overlay.style.backgroundColor = 'transparent';

    // 查找商品信息
    const matchingProducts = Object.values(productData).filter(product => product.code === code);
    
    if (matchingProducts.length > 0) {
        // 使用商品信息,但清空客户和备注等订单相关信息
        const product = matchingProducts[0];
        fillFormWithProduct({
            code: product.code,
            name: product.name || '',
            supplier: product.supplier || '',
            cost: product.cost || '',
            price: product.price || '',
            size: product.size || '',
            remark: '',  // 清空备注
            quantity: 1  // 重置数量
        });
    } else {
        // 如果没有找到商品，使用空白表单
        fillFormWithProduct({
            code: code || '',
            name: '',
            supplier: '',
            cost: '',
            price: '',
            size: '',
            remark: '',
            quantity: 1
        });
    }

    // 清空客户输入框并聚焦
    document.getElementById('editCustomer').value = '';
    document.getElementById('editCustomer').focus();
}

// 添加填充表单的辅助函数
function fillFormWithProduct(product) {
    document.getElementById('editCode').value = product.code;
    document.getElementById('editName').value = product.name || '';
    document.getElementById('editSupplier').value = product.supplier || '';
    document.getElementById('editCost').value = product.cost || '';
    document.getElementById('editPrice').value = product.price || '';
    document.getElementById('editSize').value = product.size || '';
    document.getElementById('editRemark').value = product.remark || '';
    document.getElementById('editQuantity').value = 1;
    document.getElementById('editCustomer').value = '';
}

// 关闭编辑表单
function closeEditForm() {
    const editProductForm = document.getElementById('editProductForm');
    const overlay = document.getElementById('overlay');
    editProductForm.classList.remove('active');
    overlay.classList.remove('active');
}

// 修改保存新商品数据函数
function saveNewItemData() {
    const code = document.getElementById('newItemCode').value;
    const supplier = document.getElementById('newItemSupplier').value;
    const preview = document.getElementById('newItemPreview');
    
    if (!code || !supplier) {
        alert('商品编码和供应商不能为空');
        return;
    }
    
    if (preview.style.display === 'none') {
        alert('请选择商品图片');
        return;
    }
    
    const uniqueId = `${code}_${supplier}`;
    const productData = JSON.parse(localStorage.getItem('productData') || '{}');
    
    // 检查是否已存在相同的商品和供应商组合
    if (productData[uniqueId]) {
        if (!confirm('该商品和供应商组合已存在，是否覆盖？')) {
            return;
        }
    }
    
    // 保存新商品数据
    productData[uniqueId] = {
        id: uniqueId,
        code: code,
        name: document.getElementById('newItemName').value,
        supplier: supplier,
        cost: document.getElementById('newItemCost').value,
        price: document.getElementById('newItemPrice').value,
        size: document.getElementById('newItemSize').value,
        remark: document.getElementById('newItemRemark').value,
        timestamp: new Date().toISOString()
    };

    try {
        localStorage.setItem('productData', JSON.stringify(productData));
        
        // 保存图片数据
        saveImageToDB(code, preview.src, supplier).then(() => {
            // 更新显示
            updateImageGrid();
            closeNewItemForm();
            alert('新款添加成功！');
        }).catch(error => {
            console.error('保存图片数据失败:', error);
            alert('保存图片数据失败，请重试');
        });
    } catch (error) {
        console.error('保存商品数据失败:', error);
        alert('保存失败: ' + error.message);
    }
}

// 修改打开新商品表单函数
function openNewItemForm(supplier = '') {
    const newItemForm = document.getElementById('newItemForm');
    const overlay = document.getElementById('overlay');
    
    // 清空表单
    document.getElementById('newItemCode').value = '';
    document.getElementById('newItemName').value = '';
    document.getElementById('newItemSupplier').value = supplier;
    document.getElementById('newItemCost').value = '';
    document.getElementById('newItemPrice').value = '';
    document.getElementById('newItemSize').value = '';
    document.getElementById('newItemRemark').value = '';
    
    // 清空图片预览
    const preview = document.getElementById('newItemPreview');
    preview.src = '';
    preview.style.display = 'none';
    document.getElementById('newItemImage').value = '';
    
    // 显示表单
    newItemForm.classList.add('active');
    overlay.classList.add('active');
    
    // 聚焦到商品编码输入框
    document.getElementById('newItemCode').focus();
}

// 修改关闭新商品表单函数
function closeNewItemForm() {
    const newItemForm = document.getElementById('newItemForm');
    const overlay = document.getElementById('overlay');
    newItemForm.classList.remove('active');
    overlay.classList.remove('active');
}

// 修改初始化表单提交处理
function initializeForms() {
    const newProductForm = document.getElementById('newProductForm');
    if (newProductForm) {
        newProductForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveNewItemData();
        });
    }

    const productEditForm = document.getElementById('productEditForm');
    if (productEditForm) {
        productEditForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveEditProductData();
        });
    }
    
    // 初始化订表单
    initializeOrderForm();
}

// 添加Excel处理相关函数
function initializeExcelImport() {
    const excelFile = document.getElementById('excelFile');
    excelFile.addEventListener('change', handleExcelImport);
}

// 修改 handleExcelImport 函数添加进度显示
async function handleExcelImport(event) {
    console.log('开始处理Excel导入...');
    const file = event.target.files[0];
    if (!file) {
        console.log('没有选择文件');
        return;
    }
    console.log('选择的文件:', file.name);

    const progressBar = document.querySelector('.progress-bar');
    const progress = document.querySelector('.progress');
    progressBar.style.display = 'block';
    progress.style.width = '0%';

    try {
        // 显示读取Excel进度
        console.log('开始读取Excel文件...');
        progress.style.width = '20%';
        const data = await readExcelFile(file);
        console.log('Excel文件读取完成，数据条数:', data?.length);
        
        if (data && data.length > 0) {
            // 显示处理数据进度
            progress.style.width = '40%';
            console.log(`开始处理 ${data.length} 条数据...`);
            
            // 处理Excel数据并显示度
            await processExcelData(data, progress);
            
            progress.style.width = '90%';
            console.log('开始新界面...');
            await updateImageGrid();
            progress.style.width = '100%';
            
            console.log('Excel导出成功');
            alert('Excel导入成功！');
        } else {
            throw new Error('Excel文件为空或格式不正确');
        }
    } catch (error) {
        console.error('Excel导入失败:', error);
        alert('Excel导入失败: ' + error.message);
    } finally {
        progressBar.style.display = 'none';
        progress.style.width = '0%';
        event.target.value = '';
    }
}

// 修改 processExcelData 函数，确保正确处理尺码信息
async function processExcelData(data, progress) {
    const productData = JSON.parse(localStorage.getItem('productData') || '{}');
    const startProgress = 40;
    const endProgress = 90;
    const progressStep = (endProgress - startProgress) / data.length;
    
    console.log('开始处理Excel数据...');
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const code = row['商品编码']?.toString() || '';
        if (!code) continue;

        console.log(`处理第 ${i + 1}/${data.length} 条数据，编码: ${code}`);

        // 使用编码和供应商合作为唯一标识
        const supplier = row['供应商'] || '';
        const uniqueId = `${code}_${supplier}`;

        // 更新商品数据，确保包含尺码信息
        productData[uniqueId] = {
            id: uniqueId,
            code: code,
            name: row['商品名称'] || '',
            supplier: supplier,
            cost: row['成本'] || '',
            price: row['单价'] || '',
            size: row['尺码'] || '',  // 确保保存尺码信息
            remark: row['备注'] || '',
            timestamp: new Date().toISOString()
        };

        // 创建一个默认的空白图片记录，包含供应商信息
        await saveImageToDB(code, createEmptyImage(), supplier);

        // 更新进度条
        const currentProgress = startProgress + (i + 1) * progressStep;
        progress.style.width = `${currentProgress}%`;
    }

    // 保存更新后的商品数据
    localStorage.setItem('productData', JSON.stringify(productData));
    console.log('Excel数据处理完成');
}

// 修改 readExcelFile 函数，添加尺码到必要字段
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // 检查必要字段，添加尺码
                const requiredFields = ['商品编码', '商品名称', '供应商', '成本', '单价', '尺码'];
                const firstRow = jsonData[0];
                const missingFields = requiredFields.filter(field => !(field in firstRow));

                if (missingFields.length > 0) {
                    reject(new Error(`Excel缺少必要字段: ${missingFields.join(', ')}`));
                    return;
                }

                resolve(jsonData);
            } catch (error) {
                reject(new Error('Excel文件解析失败: ' + error.message));
            }
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsBinaryString(file);
    });
}

// 创建空图片
function createEmptyImage() {
    // 创建一个100x100的空白图片
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    // 填充白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 100, 100);
    
    // 添加文字提示
    ctx.fillStyle = '#999999';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('待上传', 50, 50);
    
    return canvas.toDataURL('image/jpeg', 0.8);
}

// 修改文件夹关联处理函数
async function handleFolderSelect(event) {
    console.log('开始处理文件夹...');
    const files = Array.from(event.target.files).filter(file => 
        file.type.startsWith('image/')
    );
    
    if (!files.length) {
        alert('未找到图片文件');
        return;
    }

    const progressBar = document.querySelector('.progress-bar');
    const progress = document.querySelector('.progress');
    progressBar.style.display = 'block';
    progress.style.width = '0%';

    try {
        // 获取现有的商品数据
        const productData = JSON.parse(localStorage.getItem('productData') || '{}');
        // 收集所有可能的商品编码
        const existingProducts = new Set(
            Object.values(productData).map(product => product.code)
        );
        
        console.log('现有商品编码:', existingProducts);
        
        let matchCount = 0;
        let noMatchCount = 0;
        const noMatchFiles = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // 从文件名中提取编码（去掉扩展名）
            const code = file.name.split('.')[0];
            
            // 检查是否存在对应的商品记录
            if (existingProducts.has(code)) {
                console.log(`找到匹配商品: ${code}`);
                matchCount++;
                
                try {
                    // 压缩图片
                    const targetSize = file.size > 1024 * 1024 ? 200 : 100;
                    console.log(`压缩图片: ${code}`);
                    const compressedImageUrl = await compressImage(file, targetSize);
                    
                    // 查找该编码的所有供应商记录
                    const suppliers = Object.values(productData)
                        .filter(product => product.code === code)
                        .map(product => product.supplier);

                    // 个供应商保存图片
                    for (const supplier of suppliers) {
                        const uniqueId = `${code}_${supplier}`;
                        await saveImageToDB(code, compressedImageUrl, supplier);
                        console.log(`保存成功: ${uniqueId}`);
                    }
                } catch (err) {
                    console.error(`处理图片失败 ${code}:`, err);
                }
            } else {
                console.log(`未找到匹配的商编码: ${code}`);
                noMatchCount++;
                noMatchFiles.push(file.name);
            }
            
            // 更新进度
            const percent = ((i + 1) / files.length) * 100;
            progress.style.width = `${percent}%`;
        }
        
        // 更新显
        await updateImageGrid();
        
        // 显示详细结果
        let message = `处理完成！\n成功匹配: ${matchCount} 个\n未匹配: ${noMatchCount} 个\n总文件数: ${files.length} 个`;
        if (noMatchCount > 0) {
            message += '\n\n未匹配的文件:\n' + noMatchFiles.join('\n');
        }
        alert(message);
        
    } catch (error) {
        console.error('处理文件夹失败:', error);
        alert('处理文件夹失败: ' + error.message);
    } finally {
        progressBar.style.display = 'none';
        progress.style.width = '0%';
        event.target.value = ''; // 清空input以允许重复选择
    }
}

// 修改拖动功能
function initializeDragAndDrop() {
    const editForm = document.getElementById('editForm');
    const formHeader = document.getElementById('formHeader');
    
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    formHeader.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target === formHeader || e.target.parentElement === formHeader) {
            const rect = editForm.getBoundingClientRect();
            
            // 记录鼠标点击位置相对于表的偏移
            initialX = e.clientX - rect.left;
            initialY = e.clientY - rect.top;
            
            isDragging = true;
            editForm.setAttribute('data-moved', 'true');
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            
            // 计算新位置
            const x = e.clientX - initialX;
            const y = e.clientY - initialY;
            
            // 添加边界限制
            const rect = editForm.getBoundingClientRect();
            const parentRect = document.documentElement.getBoundingClientRect();
            
            let newX = x;
            let newY = y;
            
            // 限制左右移动
            if (newX < 0) newX = 0;
            if (newX > parentRect.width - rect.width) {
                newX = parentRect.width - rect.width;
            }
            
            // 限制上下移动
            if (newY < 0) newY = 0;
            if (newY > parentRect.height - rect.height) {
                newY = parentRect.height - rect.height;
            }
            
            // 直接设置位置，使用 transform
            editForm.style.transform = 'none';
            editForm.style.left = `${newX}px`;
            editForm.style.top = `${newY}px`;
        }
    }

    function dragEnd() {
        isDragging = false;
    }
}

// 修改打开记录管器函数
function openRecordManager() {
    // 打开新窗口
    window.open('records.html', '_blank', 'width=800,height=600');
}

function closeRecordManager() {
    const recordManager = document.getElementById('recordManager');
    const overlay = document.getElementById('overlay');
    
    if (recordManager && overlay) {
        recordManager.classList.remove('active');
        overlay.classList.remove('active');
    }
}

// 修改管理记录显示函数
function updateRecordManager() {
    const recordList = document.getElementById('recordListManager');
    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    const searchText = document.getElementById('recordSearch').value.toLowerCase();

    // 按时间倒序排序订单
    const orders = Object.values(orderData)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .filter(order => {
            const searchString = `${order.customer}${order.code}${order.name}`.toLowerCase();
            return searchString.includes(searchText);
        });

    recordList.innerHTML = orders.map(order => `
            <div class="record-item-manager">
                <div class="record-info">
                <div>客户：${order.customer || '未填写'}</div>
                <div>商品：${order.code} - ${order.name || ''}</div>
                <div>尺码：${order.size || '-'} | 数量：${order.quantity}件 | 单价：¥${order.price || '-'}</div>
                <div>供应商：${order.supplier || '-'}</div>
                <div>备注：${order.remark || '-'}</div>
                <div class="order-time">时间：${new Date(order.timestamp).toLocaleString()}</div>
                </div>
                <div class="record-actions">
                <button onclick="editRecord('${order.id}')" class="edit-btn">编辑</button>
                <button onclick="deleteRecord('${order.id}')" class="delete-btn">删除</button>
                </div>
            </div>
    `).join('');
}

// 添加删除记录功能
function deleteRecord(orderId) {
    if (!confirm('确定要删除这条记录吗？')) return;

    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    delete orderData[orderId];
    localStorage.setItem('orderData', JSON.stringify(orderData));
    
    // 更新显示
    updateRecordManager();
    updateRecentOrders();
}

// 添加编辑记录功能
function editRecord(orderId) {
    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    const order = orderData[orderId];
    if (!order) return;

    // 打开开单窗口并填充数据
    const orderForm = document.getElementById('orderForm');
    orderForm.style.display = 'block';

    // 填充表单数据
    document.getElementById('orderCode').value = order.code;
    document.getElementById('orderName').value = order.name;
    document.getElementById('orderSupplier').value = order.supplier;
    document.getElementById('orderCost').value = order.cost;
    document.getElementById('orderPrice').value = order.price;
    document.getElementById('orderCustomer').value = order.customer;
    document.getElementById('orderSize').value = order.size;
    document.getElementById('orderQuantity').value = order.quantity;
    document.getElementById('orderRemark').value = order.remark;

    // 添加编辑标记
    document.getElementById('createOrderForm').dataset.editId = orderId;
}

// 修改保存订单函数
async function saveOrder() {
    const orderForm = document.getElementById('createOrderForm');
    const editId = orderForm.dataset.editId;
    const orderId = editId || Date.now().toString();
    
    const order = {
        id: orderId,
        code: document.getElementById('orderCode').value,
        name: document.getElementById('orderName').value,
        supplier: document.getElementById('orderSupplier').value,
        cost: document.getElementById('orderCost').value,
        price: document.getElementById('orderPrice').value,
        customer: document.getElementById('orderCustomer').value,
        size: document.getElementById('orderSize').value,
        quantity: document.getElementById('orderQuantity').value,
        remark: document.getElementById('orderRemark').value,
        timestamp: new Date().toISOString(),
        username: localStorage.getItem('username')
    };
    
    try {
        // 使用 rtdb 而不是 db
        await rtdb.ref(`orders/${orderId}`).set(order);
        
        // 清空表单
        document.getElementById('orderCustomer').value = '';
        document.getElementById('orderSize').value = '';
        document.getElementById('orderQuantity').value = '1';
        document.getElementById('orderRemark').value = '';
        
        // 清除编辑标记
        delete orderForm.dataset.editId;
        
        // 聚焦到客户输入框
        document.getElementById('orderCustomer').focus();
    } catch (error) {
        console.error('保存订单失败:', error);
        alert('保存订单失败: ' + error.message);
    }
}

// 添加搜索功能
function initializeRecordSearch() {
    const searchInput = document.getElementById('recordSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchText = e.target.value.toLowerCase();
            filterRecords(searchText);
        });
    }
}

function filterRecords(searchText) {
    const recordListManager = document.getElementById('recordListManager');
    const recordData = JSON.parse(localStorage.getItem('recordData') || '{}');
    
    const filteredRecords = Object.entries(recordData)
        .filter(([code, record]) => {
            const searchString = `${code} ${record.name} ${record.supplier} ${record.customer}`.toLowerCase();
            return searchString.includes(searchText);
        })
        .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));

    recordListManager.innerHTML = filteredRecords.map(([code, record]) => `
        <div class="record-item-manager">
            <div class="record-info">
                <div>${code} - ${record.name || ''}</div>
                <div>供应商: ${record.supplier || '-'}</div>
                <div>客户: ${record.customer || '-'}</div>
                <div>成本: ${record.cost || '-'} | 单价: ${record.price || '-'}</div>
            </div>
            <div class="record-actions">
                <button onclick="editRecord('${code}')" class="edit-btn">编辑</button>
                <button onclick="deleteRecord('${code}')" class="delete-btn">删除</button>
            </div>
        </div>
    `).join('');
}

// 添加一个函数来更新商品网格的列数
function updateGridColumns(columns) {
    const supplierImages = document.querySelectorAll('.supplier-images');
    supplierImages.forEach(grid => {
        grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    });
    // 保存用户的选择
    localStorage.setItem('gridColumns', columns);
}

// 修改初始化列数控制函数
function initializeGridColumns() {
    // 获取保存的列数，默认为6
    const savedColumns = localStorage.getItem('gridColumns') || 6;
    
    // 创建列数控制器
    const controls = document.querySelector('.controls');
    const columnControl = document.createElement('div');
    columnControl.className = 'column-control';
    columnControl.innerHTML = `
        <label>每行显示：
            <input type="number" 
                   id="columnInput" 
                   value="${savedColumns}" 
                   min="1" 
                   max="12" 
                   style="width: 60px;">
            列
        </label>
    `;
    controls.appendChild(columnControl);

    // 添加事件监听器
    const columnInput = document.getElementById('columnInput');
    
    // 输入时更新
    columnInput.addEventListener('input', (e) => {
        let value = parseInt(e.target.value);
        // 限制输入范围
        if (value < 1) value = 1;
        if (value > 12) value = 12;
        updateGridColumns(value);
    });
    
    // 失去焦点时确保值在有效范围内
    columnInput.addEventListener('blur', (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value) || value < 1) value = 1;
        if (value > 12) value = 12;
        e.target.value = value;
        updateGridColumns(value);
    });

    // 初始化列数
    updateGridColumns(savedColumns);
}

// 在页面加载时初始化所有功能
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 检查浏览器支持
        if (!window.indexedDB) {
            throw new Error('您的浏览器不支持 IndexedDB，请使用现代浏览器');
        }

        console.log('开始初始化系统...');
        
        // 先初始化数据库
        console.log('正在初始化数据库...');
        await initDB();
        console.log('数据库初始化成功');

        // 初始化其他功能
        const initResults = [];

        // 使用 try-catch 分别处理每个初始化函数
        const initFunctions = [
            { name: 'initializeImageUpload', fn: initializeImageUpload },
            { name: 'initializeForms', fn: initializeForms },
            { name: 'initializeExcelImport', fn: initializeExcelImport },
            { name: 'initializeFolderInput', fn: initializeFolderInput },
            { name: 'initializeDragAndDrop', fn: initializeDragAndDrop },
            { name: 'initializeProductEditForm', fn: initializeProductEditForm },
            { name: 'initializeGridColumns', fn: initializeGridColumns }
        ];

        for (const { name, fn } of initFunctions) {
            try {
                await fn();
                console.log(`${name} 初始化成功`);
                initResults.push(`${name}: 成功`);
            } catch (error) {
                console.error(`${name} 初始化失败:`, error);
                initResults.push(`${name}: 失败 - ${error.message}`);
            }
        }

        // 更新显示
        try {
            await updateImageGrid();
            console.log('图片网格更新成功');
        } catch (error) {
            console.error('图片网格更新失败:', error);
        }

        // 添加价格显示切换功能
        const infoToggle = document.getElementById('infoToggle');
        if (infoToggle) {
            infoToggle.addEventListener('click', () => {
                document.body.classList.toggle('show-sensitive');
            });
        }

        // 设置导出日期默认为当天
        const exportDateInput = document.getElementById('exportDate');
        if (exportDateInput) {
            const today = new Date().toISOString().split('T')[0];
            exportDateInput.value = today;
        }

        // 初始化新商品图片上传
        try {
            initializeNewItemImageUpload();
            console.log('新商品图片上传初始化成功');
        } catch (error) {
            console.error('新商品图片上传初始化失败:', error);
        }

        console.log('系统初始化完成');
        console.log('初始化结果:', initResults);
    } catch (error) {
        console.error('系统初始化失败:', error);
        const errorDetails = `初始化失败: ${error.message}\n\n详细信息:\n${error.stack}`;
        console.error(errorDetails);
        alert('系统初始化失败，请查看控制台了解详细信息');
    }
});

// 添加数据库状态检查函数
function checkDBConnection() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('数据库未连接'));
            return;
        }

        try {
            const transaction = db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const request = store.count();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(new Error('数据库连接测试失败'));
        } catch (error) {
            reject(error);
        }
    });
}

// 在每次操作前检查数据库连接
async function ensureDBConnection() {
    try {
        await checkDBConnection();
    } catch (error) {
        console.log('重新连接数据库...');
        await initDB();
    }
}

// 修改清除数据功能
async function clearAllData() {
    const password = prompt('请输入管理员密码:');
    
    // 验证密码
    if (password !== '900910') {
        alert('密码错误！');
        return;
    }

    if (!confirm('确定要清除所有商品数据吗？此操作不可恢复！\n(订单数据将会保留)')) {
        return;
    }

    try {
        // 只清除商品相关数据
        localStorage.removeItem('productData');  // 清除商品数据
        
        // 清除 IndexedDB 中的图片数据
        await clearImagesFromDB();
        
        // 更新显示
        await updateImageGrid();
        
        alert('商品数据已清除！');
    } catch (error) {
        console.error('清除数据失败:', error);
        alert('清除数据失败: ' + error.message);
    }
}

// 清除 IndexedDB 中的图片数据
async function clearImagesFromDB() {
    await ensureDBConnection();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log('图片数据已清除');
                resolve();
            };
            
            request.onerror = () => {
                console.error('清除图片数据失败:', request.error);
                reject(request.error);
            };
        } catch (error) {
            console.error('清除图片数据事务失败:', error);
            reject(error);
        }
    });
}

// 修改价格比较功能为版本选择
function showPriceCompare(code) {
    const productData = JSON.parse(localStorage.getItem('productData') || '{}');
    const priceCompareModal = document.getElementById('priceCompareModal');
    const priceCompareList = document.getElementById('priceCompareList');
    
    // 找出所有相同编码的商品
    const matchingProducts = Object.values(productData).filter(product => product.code === code);
    
    if (matchingProducts.length > 0) {
        // 按价格排序
        matchingProducts.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
        
        // 生成版本选择列表
        priceCompareList.innerHTML = `
            <div class="price-compare-header">
                <h4>商品编码: ${code}</h4>
                <p>商品名称: ${matchingProducts[0].name || '-'}</p>
            </div>
            ${matchingProducts.map(product => {
                const supplier = (product.supplier || '').replace(/'/g, '&#39;');
                return `
                    <div class="price-compare-item">
                        <div class="supplier-info">
                            <div class="supplier-name">${supplier || '未知供应商'}</div>
                            <div class="extra-info">
                                <div>备注: ${product.remark || '-'}</div>
                            </div>
                        </div>
                        <div class="price-info">
                            <div class="price">¥${product.price || '-'}</div>
                            <div class="cost">成本: ¥${product.cost || '-'}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        `;
        
        priceCompareModal.classList.add('active');
        document.getElementById('overlay').classList.add('active');
    } else {
        alert('未找到相关商品信息');
    }
}

// 修改供应商导航更新函数
function updateSupplierNav() {
    const supplierNav = document.getElementById('supplierNav');
    const productData = JSON.parse(localStorage.getItem('productData') || '{}');
    
    // 从 productData 中获取所有供应商并去重
    const suppliers = [...new Set(Object.values(productData)
        .map(product => product.supplier || '未分类')
        .filter(supplier => supplier))];
    
    suppliers.sort(); // 按字母顺序排序
    
    // 生成供应商导航列表
    supplierNav.innerHTML = `
        <div class="supplier-nav-header">供应商导航</div>
        ${suppliers.map(supplier => `
            <div class="supplier-nav-item" onclick="scrollToSupplier('${supplier}')">
                ${supplier}
            </div>
        `).join('')}
    `;
}

// 添加滚动到指定供应商的函数
function scrollToSupplier(supplier) {
    const supplierSection = document.querySelector(`.supplier-group[data-supplier="${supplier}"]`);
    if (supplierSection) {
        supplierSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// 添加选择状态管理
let selectedItems = new Set();

// 添加选择/取消选功能
function toggleSelectItem(id) {
    if (selectedItems.has(id)) {
        selectedItems.delete(id);
    } else {
        selectedItems.add(id);
    }
    updateImageGrid();
    updateBatchActions();
}

// 添加批量操作按钮的显示/隐藏
function updateBatchActions() {
    const batchActions = document.getElementById('batchActions');
    if (selectedItems.size > 0) {
        batchActions.style.display = 'flex';
        batchActions.innerHTML = `
            <span class="count">已选择 ${selectedItems.size} 项</span>
            <button onclick="editSelectedItems()" class="edit-btn">编辑商品</button>
            <button onclick="deleteSelectedItems()" class="delete-btn">删除选中</button>
            <button onclick="clearSelection()" class="cancel-btn">取消选择</button>
        `;
    } else {
        batchActions.style.display = 'none';
    }
}

// 优化批量删除功能
async function deleteSelectedItems() {
    if (selectedItems.size === 0) return;
    
    if (!confirm(`确定要删除中的 ${selectedItems.size} 个商吗？此操作不可恢复！`)) {
        return;
    }

    const progressBar = document.querySelector('.progress-bar');
    const progress = document.querySelector('.progress');
    progressBar.style.display = 'block';

    try {
        const productData = JSON.parse(localStorage.getItem('productData') || '{}');
        const total = selectedItems.size;
        let completed = 0;

        // 使用 Promise.all 并发处理删除操作
        await Promise.all(Array.from(selectedItems).map(async (id) => {
            try {
                delete productData[id];
                await deleteImageFromDB(id);
                completed++;
                progress.style.width = `${(completed / total) * 100}%`;
            } catch (error) {
                console.error(`删除项 ${id} 失败:`, error);
            }
        }));

        localStorage.setItem('productData', JSON.stringify(productData));
        selectedItems.clear();
        await updateImageGrid();
        updateBatchActions();
        
        alert('删除成功！');
    } catch (error) {
        console.error('批量删除失败:', error);
        alert('删除失败，请重试');
    } finally {
        progressBar.style.display = 'none';
        progress.style.width = '0%';
    }
}

// 消所有选择
function clearSelection() {
    selectedItems.clear();
    updateImageGrid();
    updateBatchActions();
}

// 添加批量编辑能
function editSelectedItems() {
    if (selectedItems.size === 0) {
        alert('请选择要编辑的商品');
        return;
    }

    const productData = JSON.parse(localStorage.getItem('productData') || '{}');
    const firstItemId = Array.from(selectedItems)[0];
    const firstProduct = productData[firstItemId];

    // 打开商品编辑表单
    const editProductForm = document.getElementById('editProductForm');
    const overlay = document.getElementById('overlay');

    // 填充表单数据
    document.getElementById('editProductCode').value = firstProduct.code;
    document.getElementById('editProductCode').readOnly = true;
    document.getElementById('editProductName').value = firstProduct.name || '';
    document.getElementById('editProductSupplier').value = firstProduct.supplier || '';
    document.getElementById('editProductCost').value = firstProduct.cost || '';
    document.getElementById('editProductPrice').value = firstProduct.price || '';
    document.getElementById('editProductSize').value = firstProduct.size || '';
    document.getElementById('editProductRemark').value = firstProduct.remark || '';

    editProductForm.classList.add('active');
    overlay.classList.add('active');
}

// 保存商品编辑
async function saveProductEdit() {
    const productData = JSON.parse(localStorage.getItem('productData') || '{}');
    
    // 获取表单数据
    const formData = {
        name: document.getElementById('editProductName').value,
        supplier: document.getElementById('editProductSupplier').value,
        cost: document.getElementById('editProductCost').value,
        price: document.getElementById('editProductPrice').value,
        size: document.getElementById('editProductSize').value,
        remark: document.getElementById('editProductRemark').value,
        timestamp: new Date().toISOString()
    };

    // 更新所选中的商品
    for (const id of selectedItems) {
        const product = productData[id];
        productData[id] = {
            ...product,
            ...formData
        };
    }

    // 保存更新后的数据
    localStorage.setItem('productData', JSON.stringify(productData));

    // 更新显示
    await updateImageGrid();
    closeEditProductForm();
    clearSelection();

    alert('商品信息已更新');
}

// 关闭商品编辑表单
function closeEditProductForm() {
    const editProductForm = document.getElementById('editProductForm');
    const overlay = document.getElementById('overlay');
    editProductForm.classList.remove('active');
    overlay.classList.remove('active');
}

// 初始化商品编辑表单
function initializeProductEditForm() {
    const form = document.getElementById('productEditForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveProductEdit();
    });
}

// 修改导出订单数据功能
function exportData() {
    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    const exportDate = document.getElementById('exportDate').value || new Date().toISOString().split('T')[0];
    
    // 过滤当天的订单
    const dayStart = new Date(exportDate);
    const dayEnd = new Date(exportDate);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const filteredOrders = Object.values(orderData).filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= dayStart && orderDate < dayEnd;
    });

    if (filteredOrders.length === 0) {
        alert(`${exportDate} 没有订单记录`);
        return;
    }

    // 创建Excel工作表，按指定顺序排列段
    const ws = XLSX.utils.json_to_sheet(filteredOrders.map(order => {
        // 计算金额和毛利
        const quantity = Number(order.quantity) || 0;
        const price = Number(order.price) || 0;
        const cost = Number(order.cost) || 0;
        const amount = quantity * price;
        const profit = amount - (quantity * cost);

        return {
            '客户': order.customer || '',
            '商品编码': order.code || '',
            '商品名称': order.name || '',
            '尺码': order.size || '',
            '单价': Math.round(price),           // 改为整数
            '成本': Math.round(cost),            // 改为整数
            '数量': quantity,
            '金额': Math.round(amount),          // 改为整数
            '毛利': Math.round(profit),          // 改为整数
            '应商': order.supplier || '',
            '日期': new Date(order.timestamp).toLocaleString(),
            '备注': order.remark || ''
        };
    }));

    // 设置列宽
    ws['!cols'] = [
        { wch: 15 },  // 客户
        { wch: 15 },  // 商品编码
        { wch: 30 },  // 商品名称
        { wch: 10 },  // 尺码
        { wch: 10 },  // 单价
        { wch: 10 },  // 成本
        { wch: 10 },  // 数量
        { wch: 12 },  // 金额
        { wch: 12 },  // 毛利
        { wch: 15 },  // 供应商
        { wch: 20 },  // 日期
        { wch: 30 }   // 备注
    ];

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '订单记录');

    // 导出文件
    XLSX.writeFile(wb, `订单记录_${exportDate}.xlsx`);
}

// 修改导出统计功能
function exportSupplierStats() {
    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    const exportDate = document.getElementById('exportDate').value || new Date().toISOString().split('T')[0];
    
    // 过滤当天的订
    const dayStart = new Date(exportDate);
    const dayEnd = new Date(exportDate);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const filteredOrders = Object.values(orderData).filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= dayStart && orderDate < dayEnd;
    });

    if (filteredOrders.length === 0) {
        alert(`${exportDate} 没有订单记录`);
        return;
    }

    // 按供应商分组统计
    const supplierStats = {};
    filteredOrders.forEach(order => {
        const supplier = order.supplier || '未知供应商';
        if (!supplierStats[supplier]) {
            supplierStats[supplier] = {
                supplier: supplier,
                orderCount: 0,
                totalQuantity: 0,
                totalAmount: 0,
                totalCost: 0,
                orders: []
            };
        }
        
        const quantity = Number(order.quantity) || 0;
        const price = Number(order.price) || 0;
        const cost = Number(order.cost) || 0;
        
        supplierStats[supplier].orderCount++;
        supplierStats[supplier].totalQuantity += quantity;
        supplierStats[supplier].totalAmount += quantity * price;
        supplierStats[supplier].totalCost += quantity * cost;
        supplierStats[supplier].orders.push(order);
    });

    // 转换为数组并计算毛利率
    const statsArray = Object.values(supplierStats).map(stat => {
        const grossProfit = stat.totalAmount - stat.totalCost;
        const profitRate = stat.totalAmount === 0 ? 0 : (grossProfit / stat.totalAmount * 100);
        return {
            ...stat,
            grossProfit,
            profitRate
        };
    });

    // 创建工作簿
    const wb = XLSX.utils.book_new();

    // 创建汇总表
    const summaryData = statsArray.map(stat => ({
        '供应商': stat.supplier,
        '订单数': stat.orderCount,
        '总数量': stat.totalQuantity,
        '总金额': stat.totalAmount.toFixed(2),
        '总成本': stat.totalCost.toFixed(2),
        '毛利': stat.grossProfit.toFixed(2),
        '毛利率': stat.profitRate.toFixed(2) + '%'
    }));

    // 添加合计行
    const totals = statsArray.reduce((acc, stat) => ({
        orderCount: acc.orderCount + stat.orderCount,
        totalQuantity: acc.totalQuantity + stat.totalQuantity,
        totalAmount: acc.totalAmount + stat.totalAmount,
        totalCost: acc.totalCost + stat.totalCost,
        grossProfit: acc.grossProfit + stat.grossProfit
    }), { orderCount: 0, totalQuantity: 0, totalAmount: 0, totalCost: 0, grossProfit: 0 });

    const totalProfitRate = totals.totalAmount === 0 ? 0 : (totals.grossProfit / totals.totalAmount * 100);

    summaryData.push({
        '供应商': '总计',
        '订单数': totals.orderCount,
        '总数量': totals.totalQuantity,
        '总金额': totals.totalAmount.toFixed(2),
        '总成本': totals.totalCost.toFixed(2),
        '毛利': totals.grossProfit.toFixed(2),
        '毛利率': totalProfitRate.toFixed(2) + '%'
    });

    // 修改排序配置的顺序，把总成本排序放在第一位
    const sortConfigs = [
        { name: '按总成本排序', key: 'totalCost', numeric: true },
        { name: '按供应商排序', key: 'supplier' },
        { name: '按总数量排序', key: 'totalQuantity', numeric: true },
        { name: '按总金额排序', key: 'totalAmount', numeric: true },
        { name: '按毛利率排序', key: 'profitRate', numeric: true }
    ];

    // 修改工作表标题，使其更简洁
    sortConfigs.forEach(config => {
        const sortedData = [...statsArray]
            .sort((a, b) => {
                if (config.numeric) {
                    return b[config.key] - a[config.key];
                }
                return a[config.key].localeCompare(b[config.key]);
            })
            .map(stat => ({
                '供应商': stat.supplier,
                '总���本': Math.round(stat.totalCost),  // 改为四舍五入取整
                '总数量': stat.totalQuantity,
                '总金额': Math.round(stat.totalAmount), // 改为四舍五入取整
                '毛利': Math.round(stat.grossProfit),   // 改为四舍五入取整
                '毛利率': stat.profitRate.toFixed(2) + '%', // 毛利率保留两位小数
                '订单数': stat.orderCount
            }));

        // 添加合计行也使用整数
        sortedData.push({
            '供应商': '总计',
            '总成本': Math.round(totals.totalCost),
            '总数量': totals.totalQuantity,
            '总金额': Math.round(totals.totalAmount),
            '毛利': Math.round(totals.grossProfit),
            '毛利率': totalProfitRate.toFixed(2) + '%',
            '订单数': totals.orderCount
        });

        const sheet = XLSX.utils.json_to_sheet(sortedData);
        XLSX.utils.book_append_sheet(wb, sheet, config.name);

        // 调整列宽以匹配新的列顺序
        sheet['!cols'] = [
            { wch: 20 },  // 供应商
            { wch: 12 },  // 总成本
            { wch: 10 },  // 总数量
            { wch: 12 },  // 总金额
            { wch: 12 },  // 毛利
            { wch: 10 },  // 毛利率
            { wch: 10 }   // 订单数
        ];
    });

    // 为每个供应商创建详细订单表
    Object.values(supplierStats).forEach(stat => {
        const detailSheet = XLSX.utils.json_to_sheet(stat.orders.map(order => ({
            '时间': new Date(order.timestamp).toLocaleString(),
            '商品编码': order.code,
            '商品名称': order.name,
            '客户': order.customer,
            '数量': order.quantity,
            '单价': order.price,
            '金额': (Number(order.quantity) * Number(order.price)).toFixed(2),
            '成本': order.cost,
            // 修复括号位置和计算逻辑
            '毛利': (Number(order.quantity) * (Number(order.price) - Number(order.cost))).toFixed(2),
            '备注': order.remark
        })));

        // 设置详细表的列宽
        detailSheet['!cols'] = [
            { wch: 20 },  // 时间
            { wch: 15 },  // 商品编码
            { wch: 30 },  // 商品名称
            { wch: 15 },  // 户
            { wch: 10 },  // 数量
            { wch: 10 },  // 单价
            { wch: 12 },  // 金额
            { wch: 10 },  // 成本
            { wch: 12 },  // 毛利
            { wch: 20 }   // 备注
        ];

        XLSX.utils.book_append_sheet(wb, detailSheet, stat.supplier.substring(0, 31));
    });

    // 导出文件
    XLSX.writeFile(wb, `供应商统计_${exportDate}.xlsx`);
}

// 添加格式化供应商统计数据的辅助函数
function formatSupplierStat(stat) {
    const grossProfit = stat.totalAmount - stat.totalCost;
    const profitRate = stat.totalAmount === 0 ? 0 : (grossProfit / stat.totalAmount * 100);
    
    return {
        '供应商': stat.supplier,
        '订单数': stat.orderCount,
        '总数量': stat.totalQuantity,
        '总金额': stat.totalAmount.toFixed(2),
        '总成本': stat.totalCost.toFixed(2),
        '毛利': grossProfit.toFixed(2),
        '毛利率': profitRate.toFixed(2) + '%'
    };
}

// 添加导出商品数据功能
function exportProductData() {
    const productData = JSON.parse(localStorage.getItem('productData') || '{}');
    
    if (Object.keys(productData).length === 0) {
        alert('没有商品数据可导出');
        return;
    }

    try {
        // 将商品数据转换为数组格式
        const products = Object.values(productData).map(product => ({
            '商品编码': product.code,
            '商品名称': product.name || '',
            '供应商': product.supplier || '',
            '成本': product.cost || '',
            '单价': product.price || '',
            '尺码': product.size || '',
            '备注': product.remark || '',
            '最后更新时间': new Date(product.timestamp).toLocaleString()
        }));

        // 创建工作簿和工作表
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(products);

        // 设置列宽
        const colWidths = [
            { wch: 15 },  // 商品编码
            { wch: 30 },  // 商品名称
            { wch: 15 },  // 供应商
            { wch: 10 },  // 成本
            { wch: 10 },  // 单价
            { wch: 10 },  // 尺码
            { wch: 30 },  // 备注
            { wch: 20 }   // 最后更新时间
        ];
        ws['!cols'] = colWidths;

        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(wb, ws, '商品数据');

        // 导出文件
        const now = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `商品数据_${now}.xlsx`);

        alert('商品数据导出成功！');
    } catch (error) {
        console.error('导出商品数据失败:', error);
        alert('导出失败: ' + error.message);
    }
}

// 加文件夹关联功能初始化
function initializeFolderInput() {
    const folderInput = document.getElementById('folderInput');
    if (folderInput) {
        folderInput.addEventListener('change', handleFolderSelect);
    } else {
        console.error('找不到 folderInput 元素');
    }
}

// 添加一个不显示价格的客户列表
const hidePriceCustomers = ['客户A', '客户B', '客户C']; // 可以根据需���添加客户名称

// 修改生成标签的HTML内容
function generateLabelHTML(labelData) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>订单标签</title>
            <style>
                @page {
                    size: A4;
                    margin: 5mm;
                }
                body {
                    margin: 0;
                    padding: 2mm;
                }
                .label-container {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr); /* 5列 */
                    gap: 1mm;                             /* 减小间距 */
                    padding: 1mm;
                }
                .label {
                    border: 1px solid #000;
                    padding: 3px;                         /* 减小内边距 */
                    break-inside: avoid;
                    page-break-inside: avoid;
                    display: flex;
                    flex-direction: row;
                    margin-bottom: 1mm;                   /* 减小底部边距 */
                    font-size: 12px;
                    height: 55mm;                         /* 调整高度以适应10行 */
                }
                .label-image {
                    width: 50mm;                         /* ��整图片宽度 */
                    height: 50mm;                        /* 调整图片高度 */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #eee;
                    background: #f9f9f9;
                    flex-shrink: 0;
                }
                .label-image img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                .label-info {
                    flex: 1;
                    font-size: 14px;
                    padding-left: 3px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .customer-name {
                    font-size: 16px;
                    font-weight: bold;
                    text-align: center;
                    margin: 0;
                    padding: 2px 0;
                }
                .details {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .details-row {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    margin: 0;
                }
                @media print {
                    .label {
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .no-print {
                        display: none;
                    }
                    /* 每50个标签���强制分页 */
                    .label:nth-child(50) {
                        page-break-after: always;
                    }
                }
                .print-button {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 10px 20px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    z-index: 1000;
                }
                .print-button:hover {
                    background: #45a049;
                }
            </style>
        </head>
        <body>
            <button onclick="window.print()" class="print-button no-print">打印标签</button>
            <div class="label-container">
                ${labelData.map(label => {
                    // 从localStorage获取最新的客户列表
                    const hidePriceCustomers = getHidePriceCustomers();
                    const shouldShowPrice = !hidePriceCustomers.includes(label.客户);
                    
                    return `
                    <div class="label">
                        <div class="label-image">
                            <img src="${label._IMAGE_}" 
                                 alt="商品图片"
                                 onerror="console.error('图片加载失败'); this.src='${createEmptyImage()}';">
                        </div>
                        <div class="label-info">
                            <div class="customer-name">${label.客户}</div>
                            <div class="details">
                                <div class="details-row">
                                    <span>${label.尺码}</span>
                                    ${shouldShowPrice ? `<span>${label.单价}</span>` : ''}
                                </div>
                                ${label.备注 ? `<div class="details-row">${label.备注}</div>` : ''}
                            </div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </body>
        </html>
    `;
}

// 修改生成订单标签功能
async function generateOrderLabels() {
    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    const exportDate = document.getElementById('exportDate').value || new Date().toISOString().split('T')[0];
    
    // 过滤当天的订单
    const dayStart = new Date(exportDate);
    const dayEnd = new Date(exportDate);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const filteredOrders = Object.values(orderData).filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= dayStart && orderDate < dayEnd;
    });

    if (filteredOrders.length === 0) {
        alert(`${exportDate} 没有订单记录`);
        return;
    }

    try {
        console.log('开始生成标签...');
        // 为每个订单根据数量创建多个标签数据
        const labelData = await Promise.all(filteredOrders.flatMap(async order => {
            try {
                // 获取商品图片
                console.log('获取图片:', order.code, order.supplier);
                const imageData = await getImageFromDB(order.code, order.supplier);
                console.log('获取到的图片数据:', imageData);
                
                // 创建数量对应的标签数组
                const quantity = parseInt(order.quantity) || 1;
                return Array(quantity).fill().map(() => ({
                    '_IMAGE_': imageData?.file || createEmptyImage(),
                    '客户': order.customer || '',
                    '商品编码': order.code || '',
                    '尺码': order.size || '',
                    '单价': order.price || '',
                    '备注': order.remark || ''
                }));
            } catch (error) {
                console.error('处理单个订单标签失败:', error);
                return [{
                    '_IMAGE_': createEmptyImage(),
                    '客户': order.customer || '',
                    '商品编码': order.code || '',
                    '尺码': order.size || '',
                    '单价': order.price || '',
                    '备注': order.remark || ''
                }];
            }
        }));

        // 展平标签数组
        const flattenedLabelData = labelData.flat();
        console.log('生成标签数据完成，总数:', flattenedLabelData.length);

        // 生成HTML版本的标签（用于打印）
        const htmlContent = generateLabelHTML(flattenedLabelData);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    } catch (error) {
        console.error('生成标签失败:', error);
        alert('生成标签失败: ' + error.message);
    }
}

// 添加一个获取和保存不显示价格客户列表的函数
function getHidePriceCustomers() {
    return JSON.parse(localStorage.getItem('hidePriceCustomers') || '[]');
}

function saveHidePriceCustomers(customers) {
    localStorage.setItem('hidePriceCustomers', JSON.stringify(customers));
}

// 添加管理界面的数
function openHidePriceManager() {
    const customers = getHidePriceCustomers();
    const html = `
        <div class="edit-form active" id="hidePriceManager">
            <div class="form-header">
                <h3>管理不显示价格的客户</h3>
                <button class="close-btn" onclick="closeHidePriceManager()">×</button>
            </div>
            <div style="padding: 20px;">
                <div style="margin-bottom: 10px;">
                    <input type="text" id="newCustomer" placeholder="输入客户名称">
                    <button onclick="addHidePriceCustomer()" class="add-new-btn">添加</button>
                </div>
                <div id="customerList">
                    ${customers.map(customer => `
                        <div class="customer-item">
                            <span>${customer}</span>
                            <button onclick="removeHidePriceCustomer('${customer}')" class="delete-btn">删除</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // 移除可能存在的旧实例
    const oldManager = document.getElementById('hidePriceManager');
    if (oldManager) {
        oldManager.remove();
    }

    // 添加到页面
    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'block';
    overlay.classList.add('active');
}

// 关闭管理界面
function closeHidePriceManager() {
    const manager = document.getElementById('hidePriceManager');
    if (manager) {
        manager.remove();
    }
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'none';
    overlay.classList.remove('active');
}

// 添加客户到不显示价格列表
function addHidePriceCustomer() {
    const input = document.getElementById('newCustomer');
    const customer = input.value.trim();
    if (customer) {
        const customers = getHidePriceCustomers();
        if (!customers.includes(customer)) {
            customers.push(customer);
            saveHidePriceCustomers(customers);
            openHidePriceManager(); // 刷新显示
        }
        input.value = '';
    }
}

// 从不显示价格列表中移除客户
function removeHidePriceCustomer(customer) {
    const customers = getHidePriceCustomers();
    const index = customers.indexOf(customer);
    if (index > -1) {
        customers.splice(index, 1);
        saveHidePriceCustomers(customers);
        openHidePriceManager(); // 刷新显示
    }
}

// 添加清除当天订单数据的功能
async function clearTodayOrders() {
    const password = prompt('请输入管理员密码:');
    
    // 验证密码
    if (password !== '900910') {
        alert('密码错误！');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (!confirm(`确要清除 ${today} 的订单数据吗？此操作不可恢复！`)) {
        return;
    }

    try {
        // 获取订单数据
        const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
        
        // 获取今天的开始和结束时间
        const dayStart = new Date(today);
        const dayEnd = new Date(today);
        dayEnd.setDate(dayEnd.getDate() + 1);

        // 过滤掉今天的订单
        const filteredOrders = {};
        let removedCount = 0;
        
        Object.entries(orderData).forEach(([id, order]) => {
            const orderDate = new Date(order.timestamp);
            if (orderDate < dayStart || orderDate >= dayEnd) {
                filteredOrders[id] = order;
            } else {
                removedCount++;
            }
        });

        // 保存过滤后的订单数据
        localStorage.setItem('orderData', JSON.stringify(filteredOrders));
        
        // 更显示
        updateRecentRecords();
        
        alert(`清除完成！共删除 ${removedCount} 条订单数据。`);
    } catch (error) {
        console.error('清除订单数据失败:', error);
        alert('除订单数据失败: ' + error.message);
    }
}

// 修改编辑尺码的函数
function editSize(uniqueId, currentSize) {
    const newSize = prompt('请输入新的尺码:', currentSize);
    if (newSize !== null) {  // 用户点击了确定
        const productData = JSON.parse(localStorage.getItem('productData') || '{}'); // 删除多余的右括号
        if (productData[uniqueId]) {
            productData[uniqueId].size = newSize;
            productData[uniqueId].timestamp = new Date().toISOString();
            localStorage.setItem('productData', JSON.stringify(productData));
            
            // 更新显示
            updateRecordManager();
            updateImageGrid();
        }
    }
}

// 修改供应商报货表函数
async function exportSupplierOrder() {
    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    const exportDate = document.getElementById('exportDate').value || new Date().toISOString().split('T')[0];
    
    // 过滤当天的单
    const dayStart = new Date(exportDate);
    const dayEnd = new Date(exportDate);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const filteredOrders = Object.values(orderData).filter(order => {
        const orderDate = new Date(order.timestamp);
        return orderDate >= dayStart && orderDate < dayEnd;
    });

    if (filteredOrders.length === 0) {
        alert(`${exportDate} 没有订单记录`);
        return;
    }

    // 按供应商和商品编码分组统计
    const supplierOrders = {};
    filteredOrders.forEach(order => {
        const supplier = order.supplier || '未知供应商';
        if (!supplierOrders[supplier]) {
            supplierOrders[supplier] = {};
        }
        
        const code = order.code;
        if (!supplierOrders[supplier][code]) {
            supplierOrders[supplier][code] = {
                code: code,
                name: order.name || '',
                sizes: {},
                total: 0,
                supplier: supplier
            };
        }
        
        const size = order.size || '-';
        if (!supplierOrders[supplier][code].sizes[size]) {
            supplierOrders[supplier][code].sizes[size] = 0;
        }
        
        supplierOrders[supplier][code].sizes[size] += Number(order.quantity) || 0;
        supplierOrders[supplier][code].total += Number(order.quantity) || 0;
    });

    // 生成报表HTML
    const reportContent = document.querySelector('.report-content');
    reportContent.innerHTML = '';

    // 为每个供应商创建部分
    for (const [supplier, products] of Object.entries(supplierOrders)) {
        const supplierSection = document.createElement('div');
        supplierSection.className = 'supplier-section';
        
        supplierSection.innerHTML = `
            <div class="supplier-title">${supplier}</div>
            <div class="product-grid"></div>
        `;

        const productGrid = supplierSection.querySelector('.product-grid');

        for (const product of Object.values(products)) {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';

            // 获取商品图片
            let imageUrl = '';
            try {
                const imageData = await getImageFromDB(product.code, product.supplier);
                imageUrl = imageData?.file || '';
            } catch (error) {
                console.error('获取图片失败:', error);
            }

            // 获取所有尺码并排序
            const sizes = Object.entries(product.sizes).sort((a, b) => {
                const numA = parseFloat(a[0]);
                const numB = parseFloat(b[0]);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a[0].localeCompare(b[0]);
            });

            // 生成尺码网格HTML
            const sizeGridHTML = sizes.map(([size, quantity]) => `
                <div class="size-item">
                    ${size}×${quantity}
                </div>
            `).join('');

            // 修改生成商品卡片的HTML部分
            productCard.innerHTML = `
                <div class="product-image-container">
                    <img src="${imageUrl}" class="product-image" onerror="this.src='placeholder.png'">
                    <div class="product-name">${product.name || 'Air Force 1 Low'}</div>
                    <div class="product-code">${product.code}</div>
                </div>
                <div class="product-info">
                    <div class="size-grid">
                        ${sizeGridHTML}
                    </div>
                </div>
            `;

            productGrid.appendChild(productCard);
        }

        reportContent.appendChild(supplierSection);
    }

    // 显示报表
    document.getElementById('supplierOrderReport').classList.add('active');
}

// 添加关闭报表的函数
function closeSupplierReport() {
    document.getElementById('supplierOrderReport').classList.remove('active');
}

// 修改图片预览功能
function initializeNewItemImageUpload() {
    const imageInput = document.getElementById('newItemImage');
    const preview = document.getElementById('newItemPreview');
    const codeInput = document.getElementById('newItemCode');
    const supplierInput = document.getElementById('newItemSupplier');
    
    imageInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }
        
        try {
            // 从文件名中提取商品编码（去掉扩展名）
            const code = file.name.split('.')[0];
            codeInput.value = code;
            
            // 压缩图片
            const compressedImageUrl = await compressImage(file);
            preview.src = compressedImageUrl;
            preview.style.display = 'block';
            
            // 如果已存在该商品编码，自动填充其他信息，但保留当前供应商
            const productData = JSON.parse(localStorage.getItem('productData') || '{}');
            const matchingProducts = Object.values(productData).filter(p => p.code === code);
            
            if (matchingProducts.length > 0) {
                const product = matchingProducts[0];
                document.getElementById('newItemName').value = product.name || '';
                document.getElementById('newItemCost').value = product.cost || '';
                document.getElementById('newItemPrice').value = product.price || '';
                document.getElementById('newItemSize').value = product.size || '';
                document.getElementById('newItemRemark').value = product.remark || '';
                
                // 只在供应商字段为空时才填充供应商信息
                if (!supplierInput.value) {
                    supplierInput.value = product.supplier || '';
                }
            }
        } catch (error) {
            console.error('图片处理失败:', error);
            alert('图片处理失败，请重试');
        }
    });
}

// 修改开单相关函数
function openOrderForm(product) {
    const orderForm = document.getElementById('orderForm');
    
    console.log('Opening order form with product:', product); // 添加调试日志
    
    // 填充商品信息
    document.getElementById('orderCode').value = product.code || '';
    document.getElementById('orderName').value = product.name || '';
    document.getElementById('orderSupplier').value = product.supplier || '';
    document.getElementById('orderCost').value = product.cost || '';
    document.getElementById('orderPrice').value = product.price || '';
    document.getElementById('orderSize').value = product.size || '';
    
    // 聚焦到客户输入框
    document.getElementById('orderCustomer').focus();
    
    // 显示表单
    orderForm.style.display = 'block';
}

// 修改关闭开单表单函数
function closeOrderForm() {
    const orderForm = document.getElementById('orderForm');
    orderForm.style.display = 'none';
}

// 添加初始化开单表单函数
function initializeOrderForm() {
    const orderForm = document.getElementById('createOrderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveOrder();
        });
    }
    // 初始化时显示最近订单
    updateRecentOrders();
}

// 在页面加载时初始化开单表单
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // ... 其他初始化代码 ...
        
        // 初始化开单表单
        initializeOrderForm();
        
        // 显示开单窗口
        const orderForm = document.getElementById('orderForm');
        if (orderForm) {
            orderForm.style.display = 'block';
        }
        
        // ... 其他初始化代 ...
    } catch (error) {
        console.error('系统初始化失败:', error);
        alert('系统初始化失败，请查看控制台了解详细信息');
    }
});

// 修改最近订单显示函数
function updateRecentOrders() {
    const username = localStorage.getItem('username');
    
    // 监听订单数据变化
    rtdb.ref('orders')
        .orderByChild('timestamp')
        .limitToLast(10)
        .on('value', (snapshot) => {
            const orders = [];
            snapshot.forEach((child) => {
                const order = child.val();
                if (order.username === username) {
                    orders.unshift(order);
                }
            });

            const recentOrdersList = document.getElementById('recentOrdersList');
            recentOrdersList.innerHTML = orders.map(order => `
                <div class="recent-order-item">
                    <div class="order-main-info">
                        <span class="order-customer" contenteditable="true" onblur="updateOrderField('${order.id}', 'customer', this.textContent)">${order.customer || '未填写'}</span>
                        <span class="order-code">${order.code}</span>
                    </div>
                    <div class="order-second-line">
                        <span class="order-size" contenteditable="true" onblur="updateOrderField('${order.id}', 'size', this.textContent)">${order.size || '-'}</span>
                        <div class="order-quantity-price">
                            <span>${order.quantity}件</span>
                            <span class="order-price" contenteditable="true" onblur="updateOrderField('${order.id}', 'price', this.textContent)">${order.price || '-'}</span>
                        </div>
                        <span class="order-time">${new Date(order.timestamp).toLocaleTimeString()}</span>
                    </div>
                </div>
            `).join('');
        });
}

// 添加点击事件监听器
document.addEventListener('DOMContentLoaded', function() {
    const recentOrdersHeader = document.querySelector('.recent-orders-header h4');
    if (recentOrdersHeader) {
        recentOrdersHeader.addEventListener('click', openAllOrders);
    }
});

// 添加更新订单字段的函数
function updateOrderField(orderId, field, value) {
    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    if (orderData[orderId]) {
        orderData[orderId][field] = value.trim();
        localStorage.setItem('orderData', JSON.stringify(orderData));
        // 不需要重新渲染整个列表，因为内容已经更新
    }
}

// 修改打开所有订单记录的函数
function openAllOrders() {
    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
    const orders = Object.values(orderData)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>所有订单记录</title>
            <style>
                body { 
                    font-family: Arial; 
                    padding: 20px; 
                }
                .order-item {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                }
                .order-item:hover {
                    background: #f5f5f5;
                }
                [contenteditable="true"] {
                    cursor: text;
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                [contenteditable="true"]:hover {
                    background: #f0f0f0;
                }
                [contenteditable="true"]:focus {
                    background: #fff;
                    outline: 2px solid #2196F3;
                    outline-offset: -2px;
                }
                .customer { 
                    font-weight: bold; 
                    width: 100px;
                }
                .code { width: 120px; }
                .name { width: 150px; }
                .size { 
                    width: 60px;
                    text-align: center;
                }
                .quantity { 
                    width: 60px;
                    text-align: center;
                }
                .price {
                    color: #f44336;
                    font-weight: bold;
                    width: 80px;
                    text-align: right;
                }
                .supplier { width: 100px; }
                .time { 
                    color: #666;
                    width: 150px;
                }
                .header {
                    font-weight: bold;
                    padding: 10px;
                    border-bottom: 2px solid #333;
                    background: #f5f5f5;
                    position: sticky;
                    top: 0;
                }
            </style>
            <script>
                function updateField(orderId, field, value) {
                    const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
                    if (orderData[orderId]) {
                        orderData[orderId][field] = value.trim();
                        localStorage.setItem('orderData', JSON.stringify(orderData));
                    }
                }
            </script>
        </head>
        <body>
            <div class="order-item header">
                <span class="customer">客户</span>
                <span class="code">商品编码</span>
                <span class="name">商品名称</span>
                <span class="size">尺码</span>
                <span class="quantity">数量</span>
                <span class="price">单价</span>
                <span class="supplier">供应商</span>
                <span class="time">时间</span>
            </div>
            ${orders.map(order => `
                <div class="order-item">
                    <span class="customer" contenteditable="true" onblur="updateField('${order.id}', 'customer', this.textContent)">${order.customer || '未填写'}</span>
                    <span class="code">${order.code}</span>
                    <span class="name" contenteditable="true" onblur="updateField('${order.id}', 'name', this.textContent)">${order.name || '-'}</span>
                    <span class="size" contenteditable="true" onblur="updateField('${order.id}', 'size', this.textContent)">${order.size || '-'}</span>
                    <span class="quantity" contenteditable="true" onblur="updateField('${order.id}', 'quantity', this.textContent)">${order.quantity}</span>
                    <span class="price" contenteditable="true" onblur="updateField('${order.id}', 'price', this.textContent)">${order.price || '-'}</span>
                    <span class="supplier" contenteditable="true" onblur="updateField('${order.id}', 'supplier', this.textContent)">${order.supplier || '-'}</span>
                    <span class="time">${new Date(order.timestamp).toLocaleString()}</span>
                </div>
            `).join('')}
        </body>
        </html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 100);
}
 