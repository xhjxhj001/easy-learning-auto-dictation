import React, { useRef, useState } from 'react';
import { Button, Upload, message } from 'antd';
import { CameraOutlined, UploadOutlined } from '@ant-design/icons';
import { compressImage, checkFileSize } from '../utils/imageCompress';

interface CameraCaptureProps {
  onImageCapture: (file: File) => void;
  disabled?: boolean;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCapture, disabled }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File) => {
    console.log('handleFileChange 开始处理文件:', file.name);
    
    if (!file) {
      console.error('文件为空');
      message.error('请选择图片文件');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      console.error('文件类型不是图片:', file.type);
      message.error('请选择图片文件');
      return;
    }

    // 检查文件大小（最大10MB）
    if (!checkFileSize(file, 10)) {
      console.error('文件太大:', file.size);
      message.error('图片文件过大，请选择小于10MB的图片');
      return;
    }

    setIsCompressing(true);
    console.log('开始压缩图片...');
    
    try {
      // 压缩图片（如果大于1MB）
      const processedFile = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
        maxSizeKB: 1024, // 压缩到1MB以内
      });
      
      console.log('图片压缩完成，大小:', processedFile.size);

      // 显示预览
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('预览图片加载完成');
        setPreview(e.target?.result as string);
      };
      reader.onerror = (e) => {
        console.error('预览图片加载失败:', e);
      };
      reader.readAsDataURL(processedFile);

      // 调用回调
      console.log('调用 onImageCapture 回调...');
      onImageCapture(processedFile);
      console.log('onImageCapture 回调完成');
    } catch (error) {
      console.error('图片处理失败:', error);
      message.error(error instanceof Error ? error.message : '图片处理失败，请重试');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleUpload = (info: any) => {
    const file = info.file.originFileObj || info.file;
    if (file instanceof File) {
      handleFileChange(file);
    } else {
      console.error('无法获取文件对象:', info);
      message.error('无法读取文件，请重试');
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 先重置input，允许重复选择同一文件
    e.target.value = '';
    
    if (file) {
      console.log('选择了文件:', file.name, file.size, file.type);
      try {
        await handleFileChange(file);
      } catch (error) {
        console.error('handleFileChange 执行失败:', error);
        message.error('文件处理失败，请重试');
      }
    } else {
      console.log('没有选择文件');
    }
  };

  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <Button 
          icon={<UploadOutlined />} 
          disabled={disabled || isCompressing}
          onClick={handleSelectFileClick}
          loading={isCompressing}
        >
          {isCompressing ? '处理中...' : '选择图片'}
        </Button>
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={() => false}
          onChange={handleUpload}
          disabled={disabled}
          style={{ display: 'none' }}
        >
          <span></span>
        </Upload>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <Button
          icon={<CameraOutlined />}
          onClick={handleCameraClick}
          disabled={disabled || isCompressing}
          loading={isCompressing}
        >
          {isCompressing ? '处理中...' : '拍照'}
        </Button>
      </div>
      {preview && (
        <div style={{ marginTop: '10px' }}>
          <img
            src={preview}
            alt="预览"
            style={{
              maxWidth: '100%',
              maxHeight: '300px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CameraCapture;

