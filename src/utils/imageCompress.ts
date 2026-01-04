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
    const {
      maxWidth = 1920,
      maxHeight = 1920,
      quality = 0.8,
      maxSizeKB = 1024, // 默认1MB
    } = options;

    // 如果文件已经很小，直接返回
    if (file.size <= maxSizeKB * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 计算新尺寸
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // 创建canvas进行压缩
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建canvas上下文'));
          return;
        }

        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);

        // 转换为blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片压缩失败'));
              return;
            }

            // 如果压缩后仍然太大，降低质量继续压缩
            if (blob.size > maxSizeKB * 1024 && quality > 0.3) {
              canvas.toBlob(
                (smallerBlob) => {
                  if (!smallerBlob) {
                    reject(new Error('图片压缩失败'));
                    return;
                  }
                  const compressedFile = new File(
                    [smallerBlob],
                    file.name,
                    { type: file.type || 'image/jpeg' }
                  );
                  resolve(compressedFile);
                },
                file.type || 'image/jpeg',
                quality * 0.7 // 进一步降低质量
              );
            } else {
              const compressedFile = new File(
                [blob],
                file.name,
                { type: file.type || 'image/jpeg' }
              );
              resolve(compressedFile);
            }
          },
          file.type || 'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
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

