import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { Button, Form, Input, TextArea, Dropdown } from '../components/ui';
import { BASE_PATH } from '../constants';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'Obecný dotaz',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const subjectOptions = [
    'Obecný dotaz',
    'Dotaz k průvodci',
    'Technický problém',
    'Jiné'
  ];

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Jméno je povinné';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'E-mail je povinný';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Neplatný e-mail';
    }
    
    if (!formData.message.trim()) {
      newErrors.message = 'Zpráva je povinná';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Zpráva musí mít alespoň 10 znaků';
    }
    
    return newErrors;
  }, [formData]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setIsSubmitting(true);
    setErrors({});
    
    // Simulace odeslání (nahradíme skutečným API)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsSubmitted(true);
      setFormData({ name: '', email: '', subject: 'Obecný dotaz', message: '' });
    } catch {
      setErrors({ submit: 'Něco se pokazilo. Zkus to znovu.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm]);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  if (isSubmitted) {
    return (
      <Layout>
        <div className="min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center px-4 sm:px-5">
          <div className="text-center max-w-sm sm:max-w-md mx-auto">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-black mb-4">Zpráva odeslána!</h1>
            <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8 leading-relaxed">
              Děkuji za tvůj dotaz. Odpovím ti do 24 hodin na uvedený e-mail.
            </p>
            <Button 
              variant="green" 
              onClick={() => setIsSubmitted(false)}
              className="w-full sm:w-auto"
            >
              Odeslat další zprávu
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHero 
        backgroundImage={`${BASE_PATH}/images/hero-background-contact.png`}
        title="Kontakt"
        subtitle="Máš dotaz nebo potřebuješ poradit? Ráda ti pomůžu."
        overlayOpacity={0.6}
        ariaLabel="Hero sekce kontaktní stránky"
      />

      <main className="py-4 sm:py-6 md:py-8 px-4 sm:px-5" role="main">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
            
            {/* Levá strana - Osobní informace */}
            <div className="space-y-8">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">
                  Napiš mi
                </h2>
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-6 sm:mb-8">
                  Jsem Janča a ráda odpovím na tvé dotazy. Pokud potřebuješ poradit s cestováním 
                  nebo máš technický problém, neváhej se ozvat.
                </p>
              </div>

              {/* Kontaktní údaje */}
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-black mb-1">E-mail</h3>
                    <a href="mailto:info@cestybezmapy.cz" className="text-green-700 hover:text-green-800 transition-colors">
                      info@cestybezmapy.cz
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-black mb-1">Doba odpovědi</h3>
                    <p className="text-gray-600">Do 24 hodin</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-700" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-black mb-1">Instagram</h3>
                    <a 
                      href="https://www.instagram.com/cestybezmapy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-green-700 hover:text-green-800 transition-colors"
                    >
                      @cestybezmapy
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Pravá strana - Kontaktní formulář */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 md:p-8">
              <Form onSubmit={handleSubmit} spacing="md">

                <Input
                  label="Jméno"
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Tvé jméno"
                  error={errors.name}
                />

                <Input
                  label="E-mail"
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="tvuj@email.cz"
                  error={errors.email}
                />

                <Dropdown
                  label="Předmět"
                  size="md"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  options={subjectOptions}
                  fullWidth={true}
                />

                <TextArea
                  label="Zpráva"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={(e) => handleInputChange('message', e.target.value)}
                  placeholder="Napiš mi svůj dotaz..."
                  error={errors.message}
                />

                {/* Odeslat */}
                <div className="pt-2 sm:pt-4">
                  <Button 
                    type="submit" 
                    variant="green" 
                    size="lg"
                    fullWidth
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Odesílám...
                      </div>
                    ) : (
                      'Odeslat zprávu'
                    )}
                  </Button>
                </div>

                {errors.submit && (
                  <p className="text-red-600 text-sm text-center">{errors.submit}</p>
                )}
              </Form>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
};

Contact.displayName = 'Contact';

export default Contact;