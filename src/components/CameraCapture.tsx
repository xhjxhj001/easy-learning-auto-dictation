import React, { useRef, useState } from 'react';
import { Button, Upload, message } from 'antd';
import { CameraOutlined, UploadOutlined } from '@ant-design/icons';

interface CameraCaptureProps {
  onImageCapture: (file: File) => void;
  disabled?: boolean;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCapture, disabled }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      onImageCapture(file);
    } else {
      message.error('请选择图片文件');
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileChange(file);
    }
    // 重置input，允许重复选择同一文件
    e.target.value = '';
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
          disabled={disabled}
          onClick={handleSelectFileClick}
        >
          选择图片
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
          disabled={disabled}
        >
          拍照
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

