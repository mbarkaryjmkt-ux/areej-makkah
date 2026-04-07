import React, { useState, useRef } from 'react';
import './SubmitForm.css';

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const IMGBB_API_KEY = "28db43729f369058eef4ea048ddcb99b";

async function uploadToImgBB(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("image", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.data.url);
      } else {
        reject(new Error("فشل رفع الصورة إلى ImgBB"));
      }
    };

    xhr.onerror = () => reject(new Error("خطأ في الشبكة"));
    xhr.send(formData);
  });
}

function generateUploadId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default function SubmitForm() {
  const [formData, setFormData] = useState({ name: '', phone: '', type: '', description: '' });
  const [files, setFiles] = useState([]); // { file, preview, progress, url, error }
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef(null);

  const handleInput = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    const newFiles = selected.map((file) => ({
      id: generateUploadId(),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      isVideo: file.type.startsWith('video/'),
      progress: 0,
      url: null,
      error: null,
      uploading: false,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = ''; // reset input so same file can be re-selected
  };

  const removeFile = (id) => {
    setFiles((prev) => {
      const f = prev.find((f) => f.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    // 1. Upload images to ImgBB (videos are skipped - ImgBB is images only)
    const updatedFiles = [...files];
    for (let i = 0; i < updatedFiles.length; i++) {
      const item = updatedFiles[i];
      if (item.url) continue; // already uploaded

      // Skip videos - note them but don't upload
      if (item.isVideo) {
        updatedFiles[i] = { ...item, url: `VIDEO:${item.file.name}`, progress: 100 };
        setFiles([...updatedFiles]);
        continue;
      }

      try {
        updatedFiles[i] = { ...item, uploading: true };
        setFiles([...updatedFiles]);

        const url = await uploadToImgBB(item.file, (percent) => {
          updatedFiles[i] = { ...updatedFiles[i], progress: percent };
          setFiles([...updatedFiles]);
        });

        updatedFiles[i] = { ...updatedFiles[i], url, uploading: false, progress: 100 };
        setFiles([...updatedFiles]);
      } catch (err) {
        updatedFiles[i] = { ...updatedFiles[i], error: 'فشل رفع الصورة، حاول مرة أخرى', uploading: false };
        setFiles([...updatedFiles]);
      }
    }

    // 2. Submit form data to Firestore
    const imageUrls = updatedFiles.filter((f) => f.url && !f.url.startsWith('VIDEO:')).map((f) => f.url);
    const videoNames = updatedFiles.filter((f) => f.url && f.url.startsWith('VIDEO:')).map((f) => f.url.replace('VIDEO:', ''));

    try {
      await addDoc(collection(db, "properties_submissions"), {
        name: formData.name,
        phone: formData.phone,
        type: formData.type,
        description: formData.description,
        imageUrls: imageUrls,
        videoNames: videoNames,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding document to Firestore: ", error);
    }

    // 3. Redirect to WhatsApp with summary
    const number = '201148973751';
    const msg =
      `*طلب عرض عقار جديد - أريج مكة*\n\n` +
      `الاسم: ${formData.name}\n` +
      `الموبايل: ${formData.phone}\n` +
      `نوع العقار: ${formData.type}\n` +
      `التفاصيل: ${formData.description}\n` +
      (imageUrls.length ? `\n📸 عدد الصور المرفوعة: ${imageUrls.length}` : '') +
      (videoNames.length ? `\n🎬 عدد الفيديوهات: ${videoNames.length} (سيتم إرسالها يدوياً)` : '');

    window.open(`https://wa.me/${number}?text=${encodeURIComponent(msg)}`, '_blank');
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="submit-success">
        <div className="success-icon">✅</div>
        <h3>تم استلام طلبك بنجاح!</h3>
        <p>تم رفع ملفاتك وإرسال تفاصيل العقار. سنتواصل معك على واتساب قريباً.</p>
        <button className="btn btn-primary" onClick={() => { setSubmitted(false); setFiles([]); setFormData({ name: '', phone: '', type: '', description: '' }); }}>
          إضافة عقار آخر
        </button>
      </div>
    );
  }

  return (
    <form className="submit-form" onSubmit={handleSubmit} noValidate>
      <div className="form-row">
        <div className="form-group">
          <label>اسمك الكريم</label>
          <input name="name" type="text" placeholder="مثال: محمد أحمد" required value={formData.name} onChange={handleInput} />
        </div>
        <div className="form-group">
          <label>رقم الموبايل</label>
          <input name="phone" type="tel" placeholder="01xxxxxxxxx" required value={formData.phone} onChange={handleInput} />
        </div>
      </div>

      <div className="form-group">
        <label>نوع العقار</label>
        <select name="type" required value={formData.type} onChange={handleInput}>
          <option value="">اختر نوع العقار...</option>
          <option value="بيع">للبيع (تمليك)</option>
          <option value="إيجار مفروش">إيجار مفروش</option>
          <option value="إيجار على البلاط">إيجار على البلاط</option>
        </select>
      </div>

      <div className="form-group">
        <label>تفاصيل العقار</label>
        <textarea
          name="description"
          rows="4"
          placeholder="المنطقة، السعر المطلوب، المساحة، الدور، أي ملاحظات..."
          required
          value={formData.description}
          onChange={handleInput}
        />
      </div>

      {/* ─── File Upload Area ─── */}
      <div className="form-group">
        <label>صور وفيديوهات العقار</label>
        <div
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dt = e.dataTransfer;
            const event = { target: { files: dt.files, value: '' } };
            handleFileChange(event);
          }}
        >
          <span className="drop-icon">📁</span>
          <p>اسحب الصور/الفيديوهات هنا أو اضغط للاختيار</p>
          <small>يمكن رفع صور وفيديوهات كبيرة — يتم إرسالها على دفعات تلقائياً</small>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* ─── Files Preview ─── */}
      {files.length > 0 && (
        <div className="previews-grid">
          {files.map((item) => (
            <div key={item.id} className={`preview-item ${item.uploading ? 'uploading' : ''} ${item.error ? 'error' : ''}`}>
              {item.isVideo ? (
                <div className="video-thumb">
                  <span>🎬</span>
                  <p>{item.file.name.slice(0, 20)}...</p>
                </div>
              ) : (
                <img src={item.preview} alt={item.file.name} className="preview-img" />
              )}

              {/* Progress bar */}
              {item.uploading && (
                <div className="progress-bar-wrap">
                  <div className="progress-bar-fill" style={{ width: `${item.progress}%` }} />
                  <span>{item.progress}%</span>
                </div>
              )}
              {item.url && <div className="upload-done">✅ تم الرفع</div>}
              {item.error && <div className="upload-error">❌ {item.error}</div>}

              <button
                type="button"
                className="remove-btn"
                onClick={() => removeFile(item.id)}
                title="حذف"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <button type="submit" className="btn btn-primary submit-btn" disabled={submitting}>
        {submitting ? '⏳ جاري الرفع والإرسال...' : '🚀 أرسل عقارك الآن'}
      </button>
    </form>
  );
}
