import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { propertiesData } from './data';
import SubmitForm from './SubmitForm';
import AdminPanel, { getYouTubeId } from './AdminPanel';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('الكل');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch properties from Firestore in real-time
  useEffect(() => {
    try {
      const q = query(collection(db, "properties"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const props = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProperties(props);
        setLoadingProperties(false);
      }, (error) => {
        console.error("Firestore error, using demo data:", error);
        setProperties(propertiesData);
        setLoadingProperties(false);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Setup error:", err);
      setProperties(propertiesData);
      setLoadingProperties(false);
    }
  }, []);

  // Check for #admin hash
  useEffect(() => {
    if (window.location.hash === '#admin') setShowAdmin(true);
    const handleHash = () => {
      if (window.location.hash === '#admin') setShowAdmin(true);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const filterProperties = activeTab === 'الكل'
    ? properties
    : properties.filter(p => p.type?.includes(activeTab));

  const getImages = (property) => property.images || (property.image ? [property.image] : []);

  const openModal = (property) => {
    setSelectedProperty(property);
    setCurrentImgIdx(0);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProperty(null);
  };

  const handleWhatsAppClick = (propertyTitle) => {
    const defaultNumber = "201148973751";
    const message = `مرحباً، أود الاستفسار عن: ${propertyTitle}`;
    window.open(`https://wa.me/${defaultNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="app-container">
      <header className="navbar">
        <motion.div
          className="logo"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          أريج مكة <span>للتطوير العقاري</span>
        </motion.div>

        {/* Mobile Hamburger */}
        <div className="hamburger" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <span className={`bar ${isMobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`bar ${isMobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`bar ${isMobileMenuOpen ? 'open' : ''}`}></span>
        </div>

        <nav className={`nav-menu ${isMobileMenuOpen ? 'active' : ''}`}>
          <ul>
            <li><a href="#home" onClick={() => setIsMobileMenuOpen(false)}>الرئيسية</a></li>
            <li><a href="#properties" onClick={() => setIsMobileMenuOpen(false)}>العقارات</a></li>
            <li><a href="#sell" onClick={() => setIsMobileMenuOpen(false)}>سوق عقارك معانا</a></li>
            <li><a href="https://www.facebook.com/share/18hs9hLZ98/" target="_blank" rel="noopener noreferrer">فيسبوك صفحتنا</a></li>
          </ul>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section id="home" className="hero">
          <motion.div
            className="hero-content"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1>استثمر صح.. في عروس النيل الثرية</h1>
            <p>أريج مكة بوابتك الأفضل للاستثمار والوساطة العقارية في أسوان</p>
            <div className="hero-buttons">
              <a href="#properties" className="btn btn-primary">تصفح الشقق الآن</a>
              <a href="#sell" className="btn btn-secondary">إعرض عقارك معنا</a>
            </div>
          </motion.div>
          <div className="hero-overlay"></div>
        </section>

        {/* Properties Section */}
        <section id="properties" className="section properties-section">
          <div className="section-header">
            <h2>عقاراتنا المميزة</h2>
            <div className="filters">
              {['الكل', 'بيع', 'إيجار مفروش', 'إيجار على البلاط'].map(tab => (
                 <button
                  key={tab}
                  className={`filter-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                 >
                   {tab}
                 </button>
              ))}
            </div>
          </div>

          {loadingProperties ? (
            <div className="properties-grid">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="skeleton-card">
                  <div className="skeleton-img"></div>
                  <div className="skeleton-content">
                    <div className="skeleton-text title"></div>
                    <div className="skeleton-text price"></div>
                    <div className="skeleton-meta"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filterProperties.length === 0 ? (
            <div className="empty-state">
              <span>🏠</span>
              <p>لا توجد عقارات في هذا القسم حالياً</p>
            </div>
          ) : (
            <motion.div className="properties-grid" layout>
              <AnimatePresence>
                {filterProperties.map(property => (
                  <motion.div
                    key={property.id}
                    className="property-card"
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => openModal(property)}
                  >
                    <div className="property-image-container">
                      <img src={getImages(property)[0]} alt={property.title} loading="lazy" className="property-image" />
                      <span className="property-badge">{property.type}</span>
                      {getImages(property).length > 1 && (
                        <span className="property-img-count">📷 {getImages(property).length}</span>
                      )}
                    </div>
                    <div className="property-info">
                      <h3>{property.title}</h3>
                      <p className="price">{property.price}</p>
                      <div className="property-meta">
                        <span>🛏️ {property.bedrooms} غرف</span>
                        <span>🛁 {property.bathrooms} حمام</span>
                        <span>📐 {property.area}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </section>

        {/* Submit Property Section */}
        <section id="sell" className="section submit-section">
          <div className="submit-container">
            <h2>سوق عقارك معانا</h2>
            <p>هل لديك شقة للبيع أو الإيجار؟ أدخل التفاصيل هنا وصورها وفيديوهاتها وسنقوم نحن بتسويقها لك بأفضل شكل.</p>
            <SubmitForm />
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>© 2026 أريج مكة للتطوير العقاري - أسوان. جميع الحقوق محفوظة.</p>
        <button className="admin-footer-link" onClick={() => setShowAdmin(true)}>⚙ إدارة</button>
      </footer>

      {/* Property Details Modal */}
      <AnimatePresence>
        {isModalOpen && selectedProperty && (() => {
          const images = getImages(selectedProperty);
          const youtubeId = getYouTubeId(selectedProperty.youtubeUrl);
          return (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
            >
              <motion.div
                className="modal-content"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                onClick={e => e.stopPropagation()}
              >
                <button className="close-btn" onClick={closeModal}>&times;</button>

                <div className="modal-body">
                  <div className="modal-media">
                    {/* Image Gallery */}
                    <div className="gallery-main">
                      <img src={images[currentImgIdx]} alt={selectedProperty.title} className="main-media" />
                      {images.length > 1 && (
                        <>
                          <button className="gallery-nav prev" onClick={() => setCurrentImgIdx(i => i > 0 ? i - 1 : images.length - 1)}>❮</button>
                          <button className="gallery-nav next" onClick={() => setCurrentImgIdx(i => i < images.length - 1 ? i + 1 : 0)}>❯</button>
                          <span className="gallery-counter">{currentImgIdx + 1} / {images.length}</span>
                        </>
                      )}
                    </div>
                    {images.length > 1 && (
                      <div className="gallery-thumbnails">
                        {images.map((img, idx) => (
                          <img
                            key={idx} src={img} alt=""
                            className={`thumb ${idx === currentImgIdx ? 'active' : ''}`}
                            onClick={() => setCurrentImgIdx(idx)}
                          />
                        ))}
                      </div>
                    )}
                    {/* YouTube Video */}
                    {youtubeId && (
                      <div className="youtube-embed">
                        <h4>🎬 فيديو العقار</h4>
                        <iframe
                          src={`https://www.youtube.com/embed/${youtubeId}`}
                          title="Property Video"
                          allowFullScreen
                        />
                      </div>
                    )}
                    {/* Legacy video support */}
                    {!youtubeId && selectedProperty.video && (
                      <video controls muted className="main-media" style={{ marginTop: '10px' }}>
                        <source src={selectedProperty.video} type="video/mp4" />
                      </video>
                    )}
                  </div>

                  <div className="modal-info">
                    <span className="badge">{selectedProperty.type}</span>
                    <h2>{selectedProperty.title}</h2>
                    <p className="location">📍 {selectedProperty.location}</p>

                    <div className="price-tag">{selectedProperty.price}</div>

                    <div className="features">
                      <div className="feature">
                        <span className="icon">🛏️</span>
                        <span>{selectedProperty.bedrooms} غرف نوم</span>
                      </div>
                      <div className="feature">
                        <span className="icon">🛁</span>
                        <span>{selectedProperty.bathrooms} حمامات</span>
                      </div>
                      <div className="feature">
                        <span className="icon">📐</span>
                        <span>{selectedProperty.area}</span>
                      </div>
                    </div>

                    <div className="description">
                      <h3>تفاصيل العقار:</h3>
                      <p>{selectedProperty.description}</p>
                    </div>

                    <div className="modal-actions">
                      <button
                        className="btn btn-whatsapp"
                        onClick={() => handleWhatsAppClick(selectedProperty.title)}
                      >
                        📱 تواصل عبر واتساب
                      </button>
                      <a
                        href="https://www.facebook.com/share/18hs9hLZ98/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-facebook"
                      >
                        💬 تواصل عبر ماسنجر
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Admin Panel */}
      {showAdmin && (
        <AdminPanel onClose={() => { setShowAdmin(false); window.location.hash = ''; }} />
      )}
    </div>
  );
}

export default App;
