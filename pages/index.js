// pages/api/upload.js
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = new formidable.IncomingForm();
  form.uploadDir = path.join(process.cwd(), 'files');
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ message: 'Error parsing form data' });
    }

    const file = files.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
      const workbook = xlsx.readFile(file.filepath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      const validationErrors = [];

      data.forEach((row, index) => {
        Object.entries(row).forEach(([key, value]) => {
          if (value === '') {
            validationErrors.push(`Row ${index + 2}, Column "${key}": Empty cell`);
          }
          if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
            validationErrors.push(`Row ${index + 2}, Column "${key}": Numeric string "${value}"`);
          }
        });
      });

      if (validationErrors.length > 0) {
        fs.unlinkSync(file.filepath);
        return res.status(400).json({ message: 'Validation errors', errors: validationErrors });
      }

      const newFilePath = path.join(form.uploadDir, file.newFilename);
      fs.renameSync(file.filepath, newFilePath);

      res.status(200).json({ message: 'File uploaded and validated successfully' });
    } catch (error) {
      console.error('Error processing file:', error);
      fs.unlinkSync(file.filepath);
      res.status(500).json({ message: 'Error processing file' });
    }
  });
}

// pages/index.js
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState([]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message);
        setErrors([]);
      } else {
        setMessage(result.message);
        setErrors(result.errors || []);
      }
    } catch (error) {
      setMessage('An error occurred while uploading the file');
      console.error('Upload error:', error);
    }
  };

  return (
    <div>
      <h1>Excel File Upload and Validation</h1>
      <form onSubmit={handleSubmit}>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
        <button type="submit">Upload</button>
      </form>
      {message && <p>{message}</p>}
      {errors.length > 0 && (
        <div>
          <h2>Validation Errors:</h2>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
