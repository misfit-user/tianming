// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   智能地图识别系统（4 代算法合并·Phase 4 P4-α-1）
//   §1 图像核心   图像处理核心算法 · recognizeMapRegions / loadAndRecognizeMap
//   §2 UI 集成    地图识别 UI 集成 + 进度条 + 导出函数
//   §3 边界识别   基于边界线（merged map-recognition-borders）· smartRecognizeMap 自动选算法
//   §4 快速版     优化边界线识别（merged -fast）
//   §5 高质版     改进边界线识别（merged -improved）
//   §6 EU4 风格   EU4 式地图识别（merged -eu4）
// ─────────────────────────────────────────────
// 智能地图识别系统
// 自动识别地图图片中的地块并生成可编辑区域

// ============================================================
// 图像处理核心算法
// ============================================================

// P4: UI-tunable Douglas-Peucker simplify strength.
//     null => each algorithm keeps its own hard-coded default (zero behavior change).
var _TM_RECOG_EPSILON = null;
function _tmEpsFor(def){ return (_TM_RECOG_EPSILON != null && isFinite(_TM_RECOG_EPSILON) && _TM_RECOG_EPSILON > 0) ? _TM_RECOG_EPSILON : def; }

// P4: optional fragment-merge - sub-minArea blobs are absorbed into the adjacent largest region instead of dropped.
var _TM_RECOG_MERGE_FRAG = false;
var _TM_FRAGS = [];
function _assignFragmentsToRegions(regions, fragments, width, height){
  if (!fragments || !fragments.length || !regions.length) return regions;
  var owner = new Int32Array(width * height).fill(-1);
  for (var i = 0; i < regions.length; i++){
    var px = regions[i].pixels;
    for (var k = 0; k < px.length; k++) owner[px[k][1] * width + px[k][0]] = i;
  }
  fragments.sort(function(a, b){ return a.pixels.length - b.pixels.length; });
  for (var f = 0; f < fragments.length; f++){
    var frag = fragments[f], votes = {};
    for (var j = 0; j < frag.pixels.length; j++){
      var x = frag.pixels[j][0], y = frag.pixels[j][1];
      var nb = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
      for (var n = 0; n < 4; n++){
        var nx = nb[n][0], ny = nb[n][1];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        var o = owner[ny * width + nx];
        if (o >= 0) votes[o] = (votes[o] || 0) + 1;
      }
    }
    var best = -1, bestN = 0;
    for (var key in votes){ if (votes[key] > bestN){ bestN = votes[key]; best = +key; } }
    if (best >= 0){
      var target = regions[best];
      for (var m = 0; m < frag.pixels.length; m++){ var p = frag.pixels[m]; target.pixels.push(p); owner[p[1] * width + p[0]] = best; }
    }
  }
  return regions;
}

/**
 * 智能识别地图中的地块
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapRegions(image, options) {
    options = options || {};
    const tolerance = options.tolerance || 10; // 颜色容差
    _TM_RECOG_EPSILON = (options.epsilon != null && isFinite(+options.epsilon) && +options.epsilon > 0) ? +options.epsilon : null;
    _TM_RECOG_MERGE_FRAG = (options.mergeFragments === true);
    _TM_FRAGS = [];
    const minArea = options.minArea || 100; // 最小区域面积
    const simplify = options.simplify !== false; // 是否简化边界

    return new Promise((resolve, reject) => {
        try {
            // 创建离屏 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            // 获取图像数据
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            console.log('\u5f00\u59cb\u8bc6\u522b\u5730\u56fe...', {
                width: canvas.width,
                height: canvas.height,
                tolerance: tolerance
            });

            // 步骤1: 颜色聚类 - 识别所有独特的颜色区域
            const colorMap = buildColorMap(pixels, canvas.width, canvas.height, tolerance);
            console.log('\u8bc6\u522b\u5230', colorMap.size, '\u4e2a\u989c\u8272\u533a\u57df');

            // 步骤2: 区域分割 - 使用洪水填充算法
            const regions = floodFillRegions(pixels, canvas.width, canvas.height, colorMap, minArea);
            if (_TM_RECOG_MERGE_FRAG) _assignFragmentsToRegions(regions, _TM_FRAGS, canvas.width, canvas.height);
            console.log('\u5206\u5272\u51fa', regions.length, '\u4e2a\u5730\u5757');

            // 步骤3: 边界追踪 - 提取每个区域的边界
            const processedRegions = regions.map((region, index) => {
                const boundary = traceBoundary(region.pixels, canvas.width, canvas.height);

                // 简化边界（减少点数）
                const simplifiedBoundary = simplify ?
                    simplifyBoundary(boundary, _tmEpsFor(2.0)) : boundary;

                // 计算中心点
                const center = calculateCenter(region.pixels);

                return {
                    id: 'region_' + (index + 1),
                    name: '\u5730\u5757' + (index + 1),
                    color: region.color,
                    boundary: simplifiedBoundary,
                    center: center,
                    area: region.pixels.length,
                    pixels: region.pixels
                };
            });

            console.log('\u8bc6\u522b\u5b8c\u6210\uff01');
            resolve(processedRegions);

        } catch (error) {
            console.error('\u8bc6\u522b\u5931\u8d25:', error);
            reject(error);
        }
    });
}



/**
 * 洪水填充算法 - 分割区域
 */
function floodFillRegions(pixels, width, height, colorMap, minArea) {
    const visited = new Uint8Array(width * height);
    const regions = [];

    // 为每个颜色创建区域
    for (const [colorKey, colorInfo] of colorMap) {
        const [targetR, targetG, targetB] = colorKey.split(',').map(Number);

        // 查找该颜色的所有连通区域
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (visited[idx]) continue;

                const pixelIdx = idx * 4;
                const r = pixels[pixelIdx];
                const g = pixels[pixelIdx + 1];
                const b = pixels[pixelIdx + 2];

                // 检查颜色是否匹配
                const distance = Math.sqrt(
                    (r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2
                );

                if (distance <= 10) {
                    // 洪水填充
                    const regionPixels = floodFill(x, y, width, height, pixels, visited, targetR, targetG, targetB);

                    if (regionPixels.length >= minArea) {
                        regions.push({
                            color: `rgb(${targetR},${targetG},${targetB})`,
                            pixels: regionPixels
                        });
                    } else { _TM_FRAGS.push({ pixels: regionPixels }); }
                }
            }
        }
    }

    return regions;
}

/**
 * 洪水填充单个区域
 */
function floodFill(startX, startY, width, height, pixels, visited, targetR, targetG, targetB) {
    const stack = [[startX, startY]];
    const regionPixels = [];
    const tolerance = 10;

    while (stack.length > 0) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;
        if (visited[idx]) continue;

        const pixelIdx = idx * 4;
        const r = pixels[pixelIdx];
        const g = pixels[pixelIdx + 1];
        const b = pixels[pixelIdx + 2];

        const distance = Math.sqrt(
            (r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2
        );

        if (distance > tolerance) continue;

        visited[idx] = 1;
        regionPixels.push([x, y]);

        // 添加四个方向的邻居
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
    }

    return regionPixels;
}

/**
 * 边界追踪算法（Moore邻域追踪）
 */
function traceBoundary(pixels, width, height) {
    if (pixels.length === 0) return [];

    // 创建像素集合用于快速查找
    const pixelSet = new Set(pixels.map(p => `${p[0]},${p[1]}`));

    // 找到最左上角的点作为起点
    let startPoint = pixels[0];
    for (const p of pixels) {
        if (p[1] < startPoint[1] || (p[1] === startPoint[1] && p[0] < startPoint[0])) {
            startPoint = p;
        }
    }

    const boundary = [];
    const directions = [
        [0, -1], [1, -1], [1, 0], [1, 1],
        [0, 1], [-1, 1], [-1, 0], [-1, -1]
    ];

    let current = startPoint;
    let dir = 7; // 从左边开始

    do {
        boundary.push([...current]);

        // 查找下一个边界点
        let found = false;
        for (let i = 0; i < 8; i++) {
            const checkDir = (dir + i) % 8;
            const next = [
                current[0] + directions[checkDir][0],
                current[1] + directions[checkDir][1]
            ];

            if (pixelSet.has(`${next[0]},${next[1]}`)) {
                current = next;
                dir = (checkDir + 5) % 8; // 转向
                found = true;
                break;
            }
        }

        if (!found) break;

        // 防止无限循环
        if (boundary.length > pixels.length * 2) break;

    } while (current[0] !== startPoint[0] || current[1] !== startPoint[1] || boundary.length < 4);

    return boundary;
}







// ============================================================
// 地图识别 UI 集成
// ============================================================

/**
 * 显示识别进度
 */
function showRecognitionProgress(message, progress) {
    let overlay = document.getElementById('recognition-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'recognition-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        `;
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div style="text-align: center; color: #e0e0e0;">
            <div style="width: 60px; height: 60px; border: 4px solid #333; border-top-color: #d9b566; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <div style="font-size: 18px; margin-bottom: 10px;">${message}</div>
            ${progress !== undefined ? `<div style="font-size: 14px; color: #aaa;">${progress}%</div>` : ''}
        </div>
    `;
}

function hideRecognitionProgress() {
    const overlay = document.getElementById('recognition-overlay');
    if (overlay) {
        document.body.removeChild(overlay);
    }
}

/**
 * 加载并识别地图图片
 */
async function loadAndRecognizeMap(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    showRecognitionProgress('\u6b63\u5728\u5206\u6790\u5730\u56fe...', 0);

                    // 识别地块
                    const regions = await recognizeMapRegions(img, options);

                    showRecognitionProgress('\u6b63\u5728\u751f\u6210\u53ef\u7f16\u8f91\u5730\u5757...', 80);

                    // 转换为编辑器格式
                    const mapData = {
                        name: imageFile.name.replace(/\.[^/.]+$/, ''),
                        width: img.width,
                        height: img.height,
                        backgroundImage: img,
                        regions: regions.map(region => ({
                            id: region.id,
                            name: region.name,
                            coords: region.boundary.flat(),
                            center: region.center,
                            terrain: 'plains',
                            owner: '',
                            color: region.color,
                            resources: [],
                            development: 50,
                            troops: 0,
                            characters: [],
                            neighbors: []
                        }))
                    };

                    hideRecognitionProgress();
                    resolve(mapData);

                } catch (error) {
                    hideRecognitionProgress();
                    reject(error);
                }
            };

            img.onerror = function() {
                hideRecognitionProgress();
                reject(new Error('\u56fe\u7247\u52a0\u8f7d\u5931\u8d25'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('\u6587\u4ef6\u8bfb\u53d6\u5931\u8d25'));
        };

        reader.readAsDataURL(imageFile);
    });
}

// ============================================================
// 导出函数
// ============================================================

if (typeof window !== 'undefined') {
    window.recognizeMapRegions = recognizeMapRegions;
    window.loadAndRecognizeMap = loadAndRecognizeMap;
    window.showRecognitionProgress = showRecognitionProgress;
    window.hideRecognitionProgress = hideRecognitionProgress;
}

// ============================================================
// merged from map-recognition-borders.js (Phase 4·P4-α-1)
// ============================================================
// 基于边界线的地图识别系统
// 识别黑色边界线围成的地块

// ============================================================
// 边界线识别算法
// ============================================================

/**
 * 基于边界线识别地块
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapByBorders(image, options) {
    options = options || {};
    const borderThreshold = options.borderThreshold || 100; // 边界线阈值（0-255，越小越严格）
    const minArea = options.minArea || 100;
    const fillGaps = options.fillGaps !== false; // 是否填充边界线间隙
    _TM_RECOG_EPSILON = (options.epsilon != null && isFinite(+options.epsilon) && +options.epsilon > 0) ? +options.epsilon : null;
    _TM_RECOG_MERGE_FRAG = (options.mergeFragments === true);
    _TM_FRAGS = [];

    return new Promise((resolve, reject) => {
        try {
            // 创建离屏 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            // 获取图像数据
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            console.log('\u5f00\u59cb\u8fb9\u754c\u7ebf\u8bc6\u522b...', {
                width: canvas.width,
                height: canvas.height,
                borderThreshold: borderThreshold
            });

            // 步骤1: 检测边界线（黑色线条）
            const borderMap = detectBorders(pixels, canvas.width, canvas.height, borderThreshold);
            console.log('\u8fb9\u754c\u7ebf\u68c0\u6d4b\u5b8c\u6210');

            // 步骤2: 填充边界线间隙（可选）
            if (fillGaps) {
                fillBorderGaps(borderMap, canvas.width, canvas.height);
                console.log('\u8fb9\u754c\u7ebf\u95f4\u9699\u586b\u5145\u5b8c\u6210');
            }

            // 步骤3: 识别封闭区域
            const regions = findEnclosedRegions(borderMap, canvas.width, canvas.height, minArea);
            if (_TM_RECOG_MERGE_FRAG) _assignFragmentsToRegions(regions, _TM_FRAGS, canvas.width, canvas.height);
            console.log('\u8bc6\u522b\u5230', regions.length, '\u4e2a\u5c01\u95ed\u533a\u57df');

            // 步骤4: 提取区域边界
            const processedRegions = regions.map((region, index) => {
                const boundary = extractRegionBoundary(region.pixels, canvas.width, canvas.height);
                const center = calculateCenter(region.pixels);

                // 从原图提取区域颜色
                const color = extractRegionColor(pixels, region.pixels, canvas.width);

                return {
                    id: 'region_' + (index + 1),
                    name: '\u5730\u5757' + (index + 1),
                    color: color,
                    boundary: boundary,
                    center: center,
                    area: region.pixels.length,
                    pixels: region.pixels
                };
            });

            console.log('\u8fb9\u754c\u7ebf\u8bc6\u522b\u5b8c\u6210\uff01');
            resolve(processedRegions);

        } catch (error) {
            console.error('\u8bc6\u522b\u5931\u8d25:', error);
            reject(error);
        }
    });
}

/**
 * 检测边界线（黑色线条）
 */
function detectBorders(pixels, width, height, threshold) {
    const borderMap = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];

            // 检测黑色或深色像素（边界线）
            // 使用亮度公式：L = 0.299*R + 0.587*G + 0.114*B
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (a > 128 && brightness < threshold) {
                borderMap[y * width + x] = 1; // 标记为边界线
            }
        }
    }

    return borderMap;
}

/**
 * 填充边界线间隙（形态学闭运算）
 */
function fillBorderGaps(borderMap, width, height) {
    const kernel = 2; // 膨胀/腐蚀核大小

    // 膨胀操作
    const dilated = new Uint8Array(width * height);
    for (let y = kernel; y < height - kernel; y++) {
        for (let x = kernel; x < width - kernel; x++) {
            let hasBorder = false;
            for (let dy = -kernel; dy <= kernel; dy++) {
                for (let dx = -kernel; dx <= kernel; dx++) {
                    if (borderMap[(y + dy) * width + (x + dx)] === 1) {
                        hasBorder = true;
                        break;
                    }
                }
                if (hasBorder) break;
            }
            if (hasBorder) {
                dilated[y * width + x] = 1;
            }
        }
    }

    // 腐蚀操作
    for (let y = kernel; y < height - kernel; y++) {
        for (let x = kernel; x < width - kernel; x++) {
            let allBorder = true;
            for (let dy = -kernel; dy <= kernel; dy++) {
                for (let dx = -kernel; dx <= kernel; dx++) {
                    if (dilated[(y + dy) * width + (x + dx)] === 0) {
                        allBorder = false;
                        break;
                    }
                }
                if (!allBorder) break;
            }
            if (allBorder) {
                borderMap[y * width + x] = 1;
            }
        }
    }
}

/**
 * 识别封闭区域（洪水填充非边界区域）
 */
function findEnclosedRegions(borderMap, width, height, minArea) {
    const visited = new Uint8Array(width * height);
    const regions = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            // 跳过边界线和已访问的像素
            if (borderMap[idx] === 1 || visited[idx] === 1) {
                continue;
            }

            // 洪水填充找到封闭区域
            const regionPixels = floodFillRegion(x, y, width, height, borderMap, visited);

            if (regionPixels.length >= minArea) {
                regions.push({
                    pixels: regionPixels
                });
            } else { _TM_FRAGS.push({ pixels: regionPixels }); }
        }
    }

    return regions;
}

/**
 * 洪水填充单个区域（避开边界线）
 */
function floodFillRegion(startX, startY, width, height, borderMap, visited) {
    const stack = [[startX, startY]];
    const regionPixels = [];

    while (stack.length > 0) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;

        // 跳过边界线和已访问的像素
        if (borderMap[idx] === 1 || visited[idx] === 1) continue;

        visited[idx] = 1;
        regionPixels.push([x, y]);

        // 添加四个方向的邻居
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
    }

    return regionPixels;
}



/**
 * 对边界点排序（顺时针）
 */
function sortBoundaryPoints(points) {
    if (points.length === 0) return [];

    // 计算中心点
    let centerX = 0, centerY = 0;
    for (const [x, y] of points) {
        centerX += x;
        centerY += y;
    }
    centerX /= points.length;
    centerY /= points.length;

    // 按极角排序
    points.sort((a, b) => {
        const angleA = Math.atan2(a[1] - centerY, a[0] - centerX);
        const angleB = Math.atan2(b[1] - centerY, b[0] - centerX);
        return angleA - angleB;
    });

    return points;
}





// ============================================================
// 增强的识别函数（自动选择算法）
// ============================================================

/**
 * 智能识别地图（自动选择最佳算法）
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function smartRecognizeMap(image, options) {
    options = options || {};

    // 分析图片特征
    const features = analyzeImageFeatures(image);

    console.log('\u56fe\u7247\u7279\u5f81\u5206\u6790:', features);

    // 根据特征选择算法
    if (features.hasBorders) {
        console.log('\u68c0\u6d4b\u5230\u8fb9\u754c\u7ebf\uff0c\u4f7f\u7528\u8fb9\u754c\u7ebf\u8bc6\u522b\u7b97\u6cd5');
        return recognizeMapByBorders(image, options);
    } else {
        console.log('\u672a\u68c0\u6d4b\u5230\u660e\u663e\u8fb9\u754c\u7ebf\uff0c\u4f7f\u7528\u989c\u8272\u5206\u5272\u7b97\u6cd5');
        return recognizeMapRegions(image, options);
    }
}

/**
 * 分析图片特征
 */
function analyzeImageFeatures(image) {
    const canvas = document.createElement('canvas');
    const sampleSize = 200; // 采样尺寸
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, sampleSize, sampleSize);

    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    const pixels = imageData.data;

    let darkPixels = 0;
    let totalPixels = sampleSize * sampleSize;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        if (brightness < 100) {
            darkPixels++;
        }
    }

    const darkRatio = darkPixels / totalPixels;

    return {
        hasBorders: darkRatio > 0.05 && darkRatio < 0.3, // 5%-30%的暗像素表示有边界线
        darkRatio: darkRatio
    };
}

// ============================================================
// 更新加载函数
// ============================================================

/**
 * 加载并识别地图（使用边界线算法）
 */
async function loadAndRecognizeMapByBorders(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    showRecognitionProgress('\u6b63\u5728\u68c0\u6d4b\u8fb9\u754c\u7ebf...', 10);

                    // 使用边界线识别
                    const regions = await recognizeMapByBorders(img, options);

                    showRecognitionProgress('\u6b63\u5728\u751f\u6210\u53ef\u7f16\u8f91\u5730\u5757...', 80);

                    // 转换为编辑器格式
                    const mapData = {
                        name: imageFile.name.replace(/\.[^/.]+$/, ''),
                        width: img.width,
                        height: img.height,
                        backgroundImage: img,
                        regions: regions.map(region => ({
                            id: region.id,
                            name: region.name,
                            coords: region.boundary.flat(),
                            center: region.center,
                            terrain: 'plains',
                            owner: '',
                            color: region.color,
                            resources: [],
                            development: 50,
                            troops: 0,
                            characters: [],
                            neighbors: []
                        }))
                    };

                    hideRecognitionProgress();
                    resolve(mapData);

                } catch (error) {
                    hideRecognitionProgress();
                    reject(error);
                }
            };

            img.onerror = function() {
                hideRecognitionProgress();
                reject(new Error('\u56fe\u7247\u52a0\u8f7d\u5931\u8d25'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('\u6587\u4ef6\u8bfb\u53d6\u5931\u8d25'));
        };

        reader.readAsDataURL(imageFile);
    });
}

// ============================================================
// 导出函数
// ============================================================

if (typeof window !== 'undefined') {
    window.recognizeMapByBorders = recognizeMapByBorders;
    window.smartRecognizeMap = smartRecognizeMap;
    window.loadAndRecognizeMapByBorders = loadAndRecognizeMapByBorders;
}

// ============================================================
// merged from map-recognition-fast.js (Phase 4·P4-α-1)
// ============================================================
// 优化的边界线识别 - 快速版本
// 通过缩小图片提高性能

/**
 * 快速边界线识别（优化版）
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapByBordersFast(image, options) {
    options = options || {};
    const borderThreshold = options.borderThreshold || 100;
    const minArea = options.minArea || 50;
    const maxSize = 800; // 最大处理尺寸
    _TM_RECOG_EPSILON = (options.epsilon != null && isFinite(+options.epsilon) && +options.epsilon > 0) ? +options.epsilon : null;
    _TM_RECOG_MERGE_FRAG = (options.mergeFragments === true);
    _TM_FRAGS = [];

    return new Promise((resolve, reject) => {
        try {
            // 计算缩放比例
            const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
            const targetWidth = Math.floor(image.width * scale);
            const targetHeight = Math.floor(image.height * scale);

            console.log('\u5feb\u901f\u8fb9\u754c\u7ebf\u8bc6\u522b...', {
                original: `${image.width}x${image.height}`,
                scaled: `${targetWidth}x${targetHeight}`,
                scale: scale.toFixed(2)
            });

            // 创建缩小的 Canvas
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const pixels = imageData.data;

            // 步骤1: 快速检测边界线
            const borderMap = detectBordersFast(pixels, targetWidth, targetHeight, borderThreshold);

            // 步骤2: 识别封闭区域
            const regions = findEnclosedRegionsFast(borderMap, targetWidth, targetHeight, minArea);
            if (_TM_RECOG_MERGE_FRAG) _assignFragmentsToRegions(regions, _TM_FRAGS, targetWidth, targetHeight);
            console.log('\u8bc6\u522b\u5230', regions.length, '\u4e2a\u5730\u5757');

            // 步骤3: 提取边界并缩放回原始尺寸
            const processedRegions = regions.map((region, index) => {
                const boundary = extractSimpleBoundary(region.pixels);
                const center = calculateCenter(region.pixels);

                // 缩放回原始尺寸
                const scaledBoundary = boundary.map(p => [
                    Math.round(p[0] / scale),
                    Math.round(p[1] / scale)
                ]);
                const scaledCenter = [
                    Math.round(center[0] / scale),
                    Math.round(center[1] / scale)
                ];

                return {
                    id: 'region_' + (index + 1),
                    name: '\u5730\u5757' + (index + 1),
                    color: extractRegionColorFast(pixels, region.pixels, targetWidth),
                    boundary: scaledBoundary,
                    center: scaledCenter,
                    area: region.pixels.length
                };
            });

            console.log('\u5feb\u901f\u8bc6\u522b\u5b8c\u6210\uff01');
            resolve(processedRegions);

        } catch (error) {
            console.error('\u8bc6\u522b\u5931\u8d25:', error);
            reject(error);
        }
    });
}

/**
 * 快速边界线检测
 */
function detectBordersFast(pixels, width, height, threshold) {
    const borderMap = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];

            // 简化的亮度计算
            const brightness = (r + g + b) / 3;

            if (brightness < threshold) {
                borderMap[y * width + x] = 1;
            }
        }
    }

    return borderMap;
}

/**
 * 快速封闭区域识别
 */
function findEnclosedRegionsFast(borderMap, width, height, minArea) {
    const visited = new Uint8Array(width * height);
    const regions = [];

    // 使用更大的步长加速
    const step = 2;

    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const idx = y * width + x;

            if (borderMap[idx] === 1 || visited[idx] === 1) {
                continue;
            }

            const regionPixels = floodFillFast(x, y, width, height, borderMap, visited);

            if (regionPixels.length >= minArea) {
                regions.push({ pixels: regionPixels });
            } else { _TM_FRAGS.push({ pixels: regionPixels }); }
        }
    }

    return regions;
}

/**
 * 快速洪水填充
 */
function floodFillFast(startX, startY, width, height, borderMap, visited) {
    const stack = [[startX, startY]];
    const regionPixels = [];
    const maxPixels = 10000; // 限制最大像素数

    while (stack.length > 0 && regionPixels.length < maxPixels) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;
        if (borderMap[idx] === 1 || visited[idx] === 1) continue;

        visited[idx] = 1;
        regionPixels.push([x, y]);

        // 只检查4个方向（不检查对角线）
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
    }

    return regionPixels;
}

/**
 * 提取简化边界
 */
function extractSimpleBoundary(pixels) {
    if (pixels.length === 0) return [];

    // 找到边界框
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const [x, y] of pixels) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    // 返回矩形边界（简化版）
    return [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY]
    ];
}

/**
 * 快速提取区域颜色
 */
function extractRegionColorFast(pixels, regionPixels, width) {
    if (regionPixels.length === 0) return '#666666';

    // 只采样中心点
    const center = calculateCenter(regionPixels);
    const idx = (Math.floor(center[1]) * width + Math.floor(center[0])) * 4;

    const r = pixels[idx] || 100;
    const g = pixels[idx + 1] || 100;
    const b = pixels[idx + 2] || 100;

    return `rgb(${r},${g},${b})`;
}



/**
 * 快速加载并识别地图
 */
async function loadAndRecognizeMapByBordersFast(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    showRecognitionProgress('\u6b63\u5728\u5feb\u901f\u8bc6\u522b...', 20);

                    const regions = await recognizeMapByBordersFast(img, options);

                    showRecognitionProgress('\u6b63\u5728\u751f\u6210\u5730\u5757...', 80);

                    const mapData = {
                        name: imageFile.name.replace(/\.[^/.]+$/, ''),
                        width: img.width,
                        height: img.height,
                        backgroundImage: img,
                        regions: regions.map(region => ({
                            id: region.id,
                            name: region.name,
                            coords: region.boundary.flat(),
                            center: region.center,
                            terrain: 'plains',
                            owner: '',
                            color: region.color,
                            resources: [],
                            development: 50,
                            troops: 0,
                            characters: [],
                            neighbors: []
                        }))
                    };

                    hideRecognitionProgress();
                    resolve(mapData);

                } catch (error) {
                    hideRecognitionProgress();
                    reject(error);
                }
            };

            img.onerror = function() {
                hideRecognitionProgress();
                reject(new Error('\u56fe\u7247\u52a0\u8f7d\u5931\u8d25'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('\u6587\u4ef6\u8bfb\u53d6\u5931\u8d25'));
        };

        reader.readAsDataURL(imageFile);
    });
}

// 导出函数
if (typeof window !== 'undefined') {
    window.recognizeMapByBordersFast = recognizeMapByBordersFast;
    window.loadAndRecognizeMapByBordersFast = loadAndRecognizeMapByBordersFast;
}

// ============================================================
// merged from map-recognition-improved.js (Phase 4·P4-α-1)
// ============================================================
// 改进的边界线识别 - 高质量版本
// 平衡性能和质量

/**
 * 改进的边界线识别
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapByBordersImproved(image, options) {
    options = options || {};
    const borderThreshold = options.borderThreshold || 100;
    const minArea = options.minArea || 500; // 提高最小面积到500
    _TM_RECOG_EPSILON = (options.epsilon != null && isFinite(+options.epsilon) && +options.epsilon > 0) ? +options.epsilon : null;
    _TM_RECOG_MERGE_FRAG = (options.mergeFragments === true);
    _TM_FRAGS = [];
    const maxSize = 1600; // 提高到1600px保留更多细节

    return new Promise((resolve, reject) => {
        try {
            // 计算缩放比例
            const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
            const targetWidth = Math.floor(image.width * scale);
            const targetHeight = Math.floor(image.height * scale);

            console.log('改进边界线识别...', {
                original: `${image.width}x${image.height}`,
                scaled: `${targetWidth}x${targetHeight}`,
                scale: scale.toFixed(2)
            });

            // 创建Canvas
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const pixels = imageData.data;

            // 步骤1: 检测边界线
            console.log('步骤1: 检测边界线...');
            const borderMap = detectBordersImproved(pixels, targetWidth, targetHeight, borderThreshold);

            // 步骤2: 加粗边界线（确保封闭）
            console.log('步骤2: 加粗边界线...');
            thickenBorders(borderMap, targetWidth, targetHeight);

            // 步骤3: 识别封闭区域
            console.log('步骤3: 识别封闭区域...');
            const regions = findEnclosedRegionsImproved(borderMap, targetWidth, targetHeight, minArea);
            if (_TM_RECOG_MERGE_FRAG) _assignFragmentsToRegions(regions, _TM_FRAGS, targetWidth, targetHeight);

            // 过滤掉细长区域（长宽比过大的）
            const filteredRegions = regions.filter(region => {
                const bounds = getBounds(region.pixels);
                const width = bounds.maxX - bounds.minX;
                const height = bounds.maxY - bounds.minY;
                const aspectRatio = Math.max(width, height) / Math.min(width, height);

                // 更严格的过滤：长宽比<5，且面积足够大
                return aspectRatio < 5 && region.pixels.length >= minArea * 2;
            });

            console.log('识别到', filteredRegions.length, '个地块（已过滤细长区域）');

            // 创建原始图片的canvas（只创建一次）
            const originalCanvas = document.createElement('canvas');
            originalCanvas.width = image.width;
            originalCanvas.height = image.height;
            const originalCtx = originalCanvas.getContext('2d');
            originalCtx.drawImage(image, 0, 0);
            const originalImageData = originalCtx.getImageData(0, 0, image.width, image.height);
            const originalPixels = originalImageData.data;

            // 步骤4: 提取真实边界（不是矩形）
            console.log('步骤4: 提取边界...');
            const processedRegions = filteredRegions.map((region, index) => {
                const boundary = extractRealBoundary(region.pixels, targetWidth, targetHeight);
                const center = calculateCenter(region.pixels);

                // 缩放回原始尺寸
                const scaledBoundary = boundary.map(p => [
                    Math.round(p[0] / scale),
                    Math.round(p[1] / scale)
                ]);
                const scaledCenter = [
                    Math.round(center[0] / scale),
                    Math.round(center[1] / scale)
                ];

                // 从原始图片提取颜色
                const color = extractRegionColorFromOriginal(originalPixels, scaledCenter, image.width, image.height);

                // 调试：输出前10个地块的颜色
                if (index < 10) {
                    console.log(`地块${index + 1}: 中心(${scaledCenter[0]}, ${scaledCenter[1]}), 颜色: ${color}`);
                }

                return {
                    id: 'region_' + (index + 1),
                    name: '地块' + (index + 1),
                    color: color,
                    boundary: scaledBoundary,
                    center: scaledCenter,
                    area: region.pixels.length
                };
            });

            console.log('识别完成！');
            resolve(processedRegions);

        } catch (error) {
            console.error('识别失败:', error);
            reject(error);
        }
    });
}

/**
 * 改进的边界线检测
 */
function detectBordersImproved(pixels, width, height, threshold) {
    const borderMap = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];

            // 使用加权亮度计算（更准确）
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (brightness < threshold) {
                borderMap[y * width + x] = 1;
            }
        }
    }

    return borderMap;
}

/**
 * 加粗边界线（确保封闭）
 */
function thickenBorders(borderMap, width, height) {
    const temp = new Uint8Array(borderMap);

    // 膨胀操作 - 让边界线更粗
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (temp[idx] === 1) {
                // 膨胀到8邻域
                borderMap[idx - 1] = 1;
                borderMap[idx + 1] = 1;
                borderMap[idx - width] = 1;
                borderMap[idx + width] = 1;
                borderMap[idx - width - 1] = 1;
                borderMap[idx - width + 1] = 1;
                borderMap[idx + width - 1] = 1;
                borderMap[idx + width + 1] = 1;
            }
        }
    }
}

/**
 * 获取区域边界框
 */
function getBounds(pixels) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const [x, y] of pixels) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    return { minX, minY, maxX, maxY };
}

/**
 * 填充边界线间隙（形态学闭运算）
 */
function closeBorderGaps(borderMap, width, height) {
    const temp = new Uint8Array(borderMap);

    // 膨胀操作
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (borderMap[idx] === 1) {
                // 膨胀到8邻域
                temp[idx - 1] = 1;
                temp[idx + 1] = 1;
                temp[idx - width] = 1;
                temp[idx + width] = 1;
            }
        }
    }

    // 腐蚀操作
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (temp[idx] === 1) {
                let count = 0;
                // 检查8邻域
                if (temp[idx - 1] === 1) count++;
                if (temp[idx + 1] === 1) count++;
                if (temp[idx - width] === 1) count++;
                if (temp[idx + width] === 1) count++;

                if (count >= 2) {
                    borderMap[idx] = 1;
                }
            }
        }
    }
}

/**
 * 改进的封闭区域识别（不跳步）
 */
function findEnclosedRegionsImproved(borderMap, width, height, minArea) {
    const visited = new Uint8Array(width * height);
    const regions = [];

    // 不跳步，逐像素扫描
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            if (borderMap[idx] === 1 || visited[idx] === 1) {
                continue;
            }

            const regionPixels = floodFillImproved(x, y, width, height, borderMap, visited);

            if (regionPixels.length >= minArea) {
                regions.push({ pixels: regionPixels });
            } else { _TM_FRAGS.push({ pixels: regionPixels }); }
        }
    }

    return regions;
}

/**
 * 改进的洪水填充
 */
function floodFillImproved(startX, startY, width, height, borderMap, visited) {
    const stack = [[startX, startY]];
    const regionPixels = [];
    const maxPixels = 50000; // 提高限制

    while (stack.length > 0 && regionPixels.length < maxPixels) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;
        if (borderMap[idx] === 1 || visited[idx] === 1) continue;

        visited[idx] = 1;
        regionPixels.push([x, y]);

        // 4方向扩展
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
    }

    return regionPixels;
}

/**
 * 提取真实边界（轮廓跟踪）
 */
function extractRealBoundary(pixels, width, height) {
    if (pixels.length === 0) return [];

    // 创建像素集合用于快速查找
    const pixelSet = new Set();
    for (const [x, y] of pixels) {
        pixelSet.add(y * width + x);
    }

    // 找到边界像素（至少有一个邻居不在区域内）
    const boundaryPixels = [];
    for (const [x, y] of pixels) {
        const idx = y * width + x;
        let isBoundary = false;

        // 检查4邻域
        if (!pixelSet.has(idx - 1) || !pixelSet.has(idx + 1) ||
            !pixelSet.has(idx - width) || !pixelSet.has(idx + width)) {
            isBoundary = true;
        }

        if (isBoundary) {
            boundaryPixels.push([x, y]);
        }
    }

    // 简化边界（Douglas-Peucker算法）
    if (boundaryPixels.length > 100) {
        return simplifyBoundary(boundaryPixels, _tmEpsFor(2.0));
    }

    return boundaryPixels;
}

/**
 * Douglas-Peucker边界简化算法
 */
function simplifyBoundary(points, epsilon) {
    if (points.length < 3) return points;

    // 找到距离起点和终点连线最远的点
    let maxDist = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const dist = pointToLineDistance(points[i], start, end);
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    // 如果最大距离大于阈值，递归简化
    if (maxDist > epsilon) {
        const left = simplifyBoundary(points.slice(0, maxIndex + 1), epsilon);
        const right = simplifyBoundary(points.slice(maxIndex), epsilon);
        return left.slice(0, -1).concat(right);
    } else {
        return [start, end];
    }
}

/**
 * 点到线段的距离
 */
function pointToLineDistance(point, lineStart, lineEnd) {
    const [px, py] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 从原始图片提取区域颜色
 */
function extractRegionColorFromOriginal(pixels, center, width, height) {
    const [cx, cy] = center;

    // 确保坐标在范围内
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) {
        return '#666666';
    }

    // 在中心点周围采样多个点
    const samples = [];
    const radius = 5;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const x = cx + dx;
            const y = cy + dy;

            if (x >= 0 && x < width && y >= 0 && y < height) {
                const idx = (y * width + x) * 4;
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];

                // 排除黑色边界线
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                if (brightness > 100) {
                    samples.push([r, g, b]);
                }
            }
        }
    }

    if (samples.length === 0) {
        return '#666666';
    }

    // 计算平均颜色
    let r = 0, g = 0, b = 0;
    for (const [sr, sg, sb] of samples) {
        r += sr;
        g += sg;
        b += sb;
    }

    r = Math.round(r / samples.length);
    g = Math.round(g / samples.length);
    b = Math.round(b / samples.length);

    return `rgb(${r},${g},${b})`;
}

/**
 * 提取区域颜色
 */
function extractRegionColor(pixels, regionPixels, width) {
    if (regionPixels.length === 0) return '#666666';

    // 采样多个点取平均
    const sampleCount = Math.min(10, regionPixels.length);
    const step = Math.floor(regionPixels.length / sampleCount);

    let r = 0, g = 0, b = 0;

    for (let i = 0; i < sampleCount; i++) {
        const [x, y] = regionPixels[i * step];
        const idx = (y * width + x) * 4;
        r += pixels[idx] || 0;
        g += pixels[idx + 1] || 0;
        b += pixels[idx + 2] || 0;
    }

    r = Math.round(r / sampleCount);
    g = Math.round(g / sampleCount);
    b = Math.round(b / sampleCount);

    return `rgb(${r},${g},${b})`;
}

/**
 * 计算中心点
 */
function calculateCenter(pixels) {
    if (pixels.length === 0) return [0, 0];

    let sumX = 0, sumY = 0;
    for (const [x, y] of pixels) {
        sumX += x;
        sumY += y;
    }

    return [
        Math.round(sumX / pixels.length),
        Math.round(sumY / pixels.length)
    ];
}

/**
 * 加载并识别地图
 */
async function loadAndRecognizeMapByBordersImproved(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    const regions = await recognizeMapByBordersImproved(img, options);

                    const mapData = {
                        name: imageFile.name.replace(/\.[^/.]+$/, ''),
                        width: img.width,
                        height: img.height,
                        backgroundImage: img,
                        regions: regions.map(region => ({
                            id: region.id,
                            name: region.name,
                            coords: region.boundary.flat(),
                            center: region.center,
                            terrain: 'plains',
                            owner: '',
                            color: region.color,
                            resources: [],
                            development: 50,
                            troops: 0,
                            characters: [],
                            neighbors: []
                        }))
                    };

                    resolve(mapData);

                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = function() {
                reject(new Error('图片加载失败'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('文件读取失败'));
        };

        reader.readAsDataURL(imageFile);
    });
}

// 导出函数
if (typeof window !== 'undefined') {
    window.recognizeMapByBordersImproved = recognizeMapByBordersImproved;
    window.loadAndRecognizeMapByBordersImproved = loadAndRecognizeMapByBordersImproved;
}

// ============================================================
// merged from map-recognition-eu4.js (Phase 4·P4-α-1)
// ============================================================
// EU4风格的地图识别
// 基于颜色ID识别省份

/**
 * EU4风格地图识别
 * 每个省份使用唯一的RGB颜色
 * @param {HTMLImageElement} image - 地图图片
 * @param {Object} options - 识别选项
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise<Array>} - 识别出的地块数组
 */
async function recognizeMapEU4Style(image, options, progressCallback) {
    options = options || {};
    const minArea = options.minArea || 100;
    const colorTolerance = options.colorTolerance || 1;
    const maxSize = options.maxSize || 1500; // 最大尺寸限制
    _TM_RECOG_EPSILON = (options.epsilon != null && isFinite(+options.epsilon) && +options.epsilon > 0) ? +options.epsilon : null;
    _TM_RECOG_MERGE_FRAG = (options.mergeFragments === true);
    _TM_FRAGS = [];

    return new Promise((resolve, reject) => {
        try {
            console.log('EU4风格地图识别...', {
                size: `${image.width}x${image.height}`
            });

            if (progressCallback) progressCallback(5, '正在准备图片...');

            // 如果图片太大，先缩小
            let processImage = image;
            let scale = 1;
            if (image.width > maxSize || image.height > maxSize) {
                scale = Math.min(maxSize / image.width, maxSize / image.height);
                console.log('图片过大，缩小到', Math.round(scale * 100) + '%');

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = Math.round(image.width * scale);
                tempCanvas.height = Math.round(image.height * scale);
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(image, 0, 0, tempCanvas.width, tempCanvas.height);

                // 创建新的Image对象
                processImage = new Image();
                processImage.src = tempCanvas.toDataURL();

                // 等待图片加载
                processImage.onload = function() {
                    continueRecognition(processImage, scale);
                };
                return;
            }

            continueRecognition(processImage, scale);

            function continueRecognition(img, scaleRatio) {
                if (progressCallback) progressCallback(10, '正在加载图片...');

                // 创建Canvas
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const pixels = imageData.data;

                if (progressCallback) progressCallback(20, '正在分析颜色...');

                // 步骤1: 收集所有唯一颜色
                console.log('步骤1: 分析颜色...');
                const colorMap = buildColorMap(pixels, img.width, img.height, colorTolerance);
                console.log('发现', colorMap.size, '种不同颜色');

                if (progressCallback) progressCallback(40, `发现 ${colorMap.size} 种颜色，正在识别省份...`);

                // 步骤2: 为每种颜色识别区域
                console.log('步骤2: 识别省份...');
                identifyRegionsByColor(pixels, img.width, img.height, colorMap, minArea, progressCallback).then(regions => {
                    if (_TM_RECOG_MERGE_FRAG) _assignFragmentsToRegions(regions, _TM_FRAGS, img.width, img.height);
                    console.log('识别到', regions.length, '个省份');

                    if (progressCallback) progressCallback(80, `识别到 ${regions.length} 个省份，正在提取边界...`);

                    // 步骤3: 提取边界和属性
                    console.log('步骤3: 提取边界...');
                    const processedRegions = regions.map((region, index) => {
                        const boundary = extractRegionBoundary(region.pixels, img.width, img.height);
                        const center = calculateRegionCenter(region.pixels);

                        if (progressCallback && index % 10 === 0) {
                            const percent = 80 + (index / regions.length) * 15;
                            progressCallback(percent, `处理省份 ${index + 1}/${regions.length}...`);
                        }

                        // 如果图片被缩放了，需要将坐标还原
                        const scaledBoundary = scaleRatio !== 1
                            ? boundary.map(([x, y]) => [Math.round(x / scaleRatio), Math.round(y / scaleRatio)])
                            : boundary;
                        const scaledCenter = scaleRatio !== 1
                            ? [Math.round(center[0] / scaleRatio), Math.round(center[1] / scaleRatio)]
                            : center;

                        return {
                            id: 'province_' + (index + 1),
                            name: '省份' + (index + 1),
                            color: region.color,
                            boundary: scaledBoundary,
                            center: scaledCenter,
                            area: region.pixels.length
                        };
                    });

                    if (progressCallback) progressCallback(95, '正在完成...');

                    console.log('识别完成！');

                    if (progressCallback) progressCallback(100, '识别完成！');

                    resolve(processedRegions);
                }).catch(error => {
                    reject(error);
                });
            }
        } catch (error) {
            console.error('识别失败:', error);
            reject(error);
        }
    });
}

/**
 * 构建颜色映射表
 */
function buildColorMap(pixels, width, height, tolerance) {
    const colorMap = new Map();
    const visited = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (visited[idx]) continue;

            const pixelIdx = idx * 4;
            const r = pixels[pixelIdx];
            const g = pixels[pixelIdx + 1];
            const b = pixels[pixelIdx + 2];

            // 跳过纯黑色（边界线）
            if (r < 10 && g < 10 && b < 10) {
                visited[idx] = 1;
                continue;
            }

            const colorKey = `${r},${g},${b}`;

            // 查找是否已有相似颜色
            let foundColor = null;
            for (const [key, data] of colorMap.entries()) {
                const [kr, kg, kb] = key.split(',').map(Number);
                const diff = Math.abs(r - kr) + Math.abs(g - kg) + Math.abs(b - kb);
                if (diff <= tolerance) {
                    foundColor = key;
                    break;
                }
            }

            if (foundColor) {
                colorMap.get(foundColor).count++;
            } else {
                colorMap.set(colorKey, {
                    r, g, b,
                    count: 1
                });
            }

            visited[idx] = 1;
        }
    }

    return colorMap;
}

/**
 * 按颜色识别区域（分块执行，避免阻塞）
 */
function identifyRegionsByColor(pixels, width, height, colorMap, minArea, progressCallback) {
    const regions = [];
    const visited = new Uint8Array(width * height);
    const totalPixels = width * height;
    let processedPixels = 0;
    let cancelled = false;

    // 暴露取消函数
    window._cancelMapRecognition = function() {
        cancelled = true;
    };

    return new Promise((resolve, reject) => {
        let y = 0;

        function processChunk() {
            if (cancelled) {
                reject(new Error('用户取消'));
                return;
            }

            const startTime = Date.now();
            const chunkSize = 50; // 每次处理50行

            for (let row = 0; row < chunkSize && y < height; row++, y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (visited[idx]) continue;

                    const pixelIdx = idx * 4;
                    const r = pixels[pixelIdx];
                    const g = pixels[pixelIdx + 1];
                    const b = pixels[pixelIdx + 2];

                    // 跳过黑色边界
                    if (r < 10 && g < 10 && b < 10) {
                        visited[idx] = 1;
                        continue;
                    }

                    // 洪水填充相同颜色的区域
                    const regionPixels = floodFillByColor(x, y, r, g, b, pixels, width, height, visited);

                    if (regionPixels.length >= minArea) {
                        regions.push({
                            pixels: regionPixels,
                            color: `rgb(${r},${g},${b})`
                        });
                    } else { _TM_FRAGS.push({ pixels: regionPixels }); }

                    processedPixels += regionPixels.length;
                }
            }

            // 更新进度
            if (progressCallback) {
                const percent = 40 + (y / height) * 35;
                progressCallback(percent, `识别省份中... ${regions.length} 个`);
            }

            // 继续处理或完成
            if (y < height) {
                setTimeout(processChunk, 0); // 让出控制权
            } else {
                delete window._cancelMapRecognition;
                resolve(regions);
            }
        }

        processChunk();
    });
}

/**
 * 按颜色洪水填充
 */
function floodFillByColor(startX, startY, targetR, targetG, targetB, pixels, width, height, visited) {
    const stack = [[startX, startY]];
    const regionPixels = [];
    const tolerance = 3; // 进一步降低容差到3，避免海洋和岛屿混淆

    while (stack.length > 0) {
        const [x, y] = stack.pop();

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const idx = y * width + x;
        if (visited[idx]) continue;

        const pixelIdx = idx * 4;
        const r = pixels[pixelIdx];
        const g = pixels[pixelIdx + 1];
        const b = pixels[pixelIdx + 2];

        // 检查颜色是否匹配
        const diff = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB);
        if (diff > tolerance) continue;

        visited[idx] = 1;
        regionPixels.push([x, y]);

        // 4方向扩展
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
    }

    return regionPixels;
}

/**
 * 提取区域边界
 */
function extractRegionBoundary(pixels, width, height) {
    if (pixels.length === 0) return [];

    // 创建像素集合
    const pixelSet = new Set();
    for (const [x, y] of pixels) {
        pixelSet.add(y * width + x);
    }

    // 找到边界像素
    const boundaryPixels = [];
    for (const [x, y] of pixels) {
        const idx = y * width + x;
        let isBoundary = false;

        // 检查4邻域
        if (!pixelSet.has(idx - 1) || !pixelSet.has(idx + 1) ||
            !pixelSet.has(idx - width) || !pixelSet.has(idx + width)) {
            isBoundary = true;
        }

        if (isBoundary) {
            boundaryPixels.push([x, y]);
        }
    }

    // 简化边界
    if (boundaryPixels.length > 50) {
        return simplifyPolygon(boundaryPixels, _tmEpsFor(3.0));
    }

    return boundaryPixels;
}

/**
 * 简化多边形
 */
function simplifyPolygon(points, epsilon) {
    if (points.length < 3) return points;

    let maxDist = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const dist = pointLineDistance(points[i], start, end);
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    if (maxDist > epsilon) {
        const left = simplifyPolygon(points.slice(0, maxIndex + 1), epsilon);
        const right = simplifyPolygon(points.slice(maxIndex), epsilon);
        return left.slice(0, -1).concat(right);
    } else {
        return [start, end];
    }
}

/**
 * 点到线段距离
 */
function pointLineDistance(point, lineStart, lineEnd) {
    const [px, py] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 计算区域中心
 */
function calculateRegionCenter(pixels) {
    if (pixels.length === 0) return [0, 0];

    let sumX = 0, sumY = 0;
    for (const [x, y] of pixels) {
        sumX += x;
        sumY += y;
    }

    return [
        Math.round(sumX / pixels.length),
        Math.round(sumY / pixels.length)
    ];
}

/**
 * 加载并识别地图（EU4风格）
 */
async function loadAndRecognizeMapEU4Style(imageFile, options, progressCallback) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    const regions = await recognizeMapEU4Style(img, options, progressCallback);

                    const mapData = {
                        name: imageFile.name.replace(/\.[^/.]+$/, ''),
                        width: img.width,
                        height: img.height,
                        backgroundImage: img,
                        regions: regions.map(region => ({
                            id: region.id,
                            name: region.name,
                            coords: region.boundary.flat(),
                            center: region.center,
                            terrain: 'plains',
                            owner: '',
                            color: region.color,
                            resources: [],
                            development: 50,
                            troops: 0,
                            characters: [],
                            neighbors: []
                        }))
                    };

                    resolve(mapData);

                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = function() {
                reject(new Error('图片加载失败'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('文件读取失败'));
        };

        reader.readAsDataURL(imageFile);
    });
}

// 导出函数
if (typeof window !== 'undefined') {
    window.recognizeMapEU4Style = recognizeMapEU4Style;
    window.loadAndRecognizeMapEU4Style = loadAndRecognizeMapEU4Style;
}
