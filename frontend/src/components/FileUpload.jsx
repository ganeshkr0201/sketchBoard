import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import axios from 'axios';
import './FileUpload.css';

const FileUpload = ({ roomId }) => {
  const [uploading, setUploading] = useState(false);
  const { token } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);

    setUploading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await axios.post(
        `${API_URL}/api/files/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      socket.emit('file-uploaded', {
        roomId,
        fileData: response.data.file
      });
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <h3>File Upload</h3>
      <input
        type="file"
        onChange={handleFileUpload}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
    </div>
  );
};

export default FileUpload;
