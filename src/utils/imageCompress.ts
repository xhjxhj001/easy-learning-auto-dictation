/**
 * 图片压缩工具
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number; // 最大文件大小（KB）
}

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns 压缩后的File对象
 */
export function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  return new Promise((resolve, reject) => {
    console.log('[compressImage] 开始压缩图片:', file.name, '大小:', file.size);
    
    const {
      maxWidth = 1500, // 从 1920 降至 1500
      maxHeight = 1500,
      quality = 0.7,   // 降低初始质量
      maxSizeKB = 400, // 从 1024 降至 400KB，大幅减少上传量
    } = options;

    // 如果文件已经很小，直接返回
    if (file.size <= maxSizeKB * 1024) {
      console.log('[compressImage] 文件已经很小，无需压缩');
      resolve(file);
      return;
    }

    console.log('[compressImage] 文件较大，开始压缩...');
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      console.log('[compressImage] FileReader 加载完成');
      
      if (!e.target?.result) {
        console.error('[compressImage] FileReader 结果为空');
        reject(new Error('文件读取结果为空'));
        return;
      }
      
      const img = new Image();
      
      img.onload = () => {
        console.log('[compressImage] 图片加载完成, 尺寸:', img.width, 'x', img.height);
        
        try {
          // 计算新尺寸
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
            console.log('[compressImage] 调整尺寸为:', width, 'x', height);
          }

          // 创建canvas进行压缩
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.error('[compressImage] 无法创建canvas上下文');
            reject(new Error('无法创建canvas上下文'));
            return;
          }

          // 绘制图片
          ctx.drawImage(img, 0, 0, width, height);
          console.log('[compressImage] 图片绘制到canvas完成');

          // 转换为blob - 使用jpeg格式确保兼容性
          const outputType = 'image/jpeg';
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                console.error('[compressImage] toBlob 返回空');
                reject(new Error('图片压缩失败'));
                return;
              }

              console.log('[compressImage] 第一次压缩完成, 大小:', blob.size);

              // 如果压缩后仍然太大，降低质量继续压缩
              if (blob.size > maxSizeKB * 1024 && quality > 0.3) {
                console.log('[compressImage] 文件仍然较大，进行二次压缩...');
                canvas.toBlob(
                  (smallerBlob) => {
                    if (!smallerBlob) {
                      console.error('[compressImage] 二次压缩 toBlob 返回空');
                      reject(new Error('图片压缩失败'));
                      return;
                    }
                    console.log('[compressImage] 二次压缩完成, 大小:', smallerBlob.size);
                    const compressedFile = new File(
                      [smallerBlob],
                      file.name.replace(/\.[^.]+$/, '.jpg'),
                      { type: outputType }
                    );
                    resolve(compressedFile);
                  },
                  outputType,
                  quality * 0.7 // 进一步降低质量
                );
              } else {
                const compressedFile = new File(
                  [blob],
                  file.name.replace(/\.[^.]+$/, '.jpg'),
                  { type: outputType }
                );
                console.log('[compressImage] 压缩完成，最终大小:', compressedFile.size);
                resolve(compressedFile);
              }
            },
            outputType,
            quality
          );
        } catch (error) {
          console.error('[compressImage] 压缩过程出错:', error);
          reject(error);
        }
      };

      img.onerror = (error) => {
        console.error('[compressImage] 图片加载失败:', error);
        reject(new Error('图片加载失败'));
      };

      img.src = e.target.result as string;
    };

    reader.onerror = (error) => {
      console.error('[compressImage] FileReader 读取失败:', error);
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 检查文件大小
 * @param file 文件对象
 * @param maxSizeMB 最大大小（MB）
 * @returns 是否超过限制
 */
export function checkFileSize(file: File, maxSizeMB: number = 10): boolean {
  return file.size <= maxSizeMB * 1024 * 1024;
}

