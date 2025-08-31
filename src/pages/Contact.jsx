import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { Button, Input, TextArea, Dropdown } from '../components/ui';
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
    'Spolupráce',
    'Jiné'
  ];

  const validateForm = () => {
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
  };

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
    } catch (error) {
      setErrors({ submit: 'Něco se pokazilo. Zkuste to znovu.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData]);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  if (isSubmitted) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center px-5">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-4">Zpráva odeslána!</h1>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Děkuji za váš dotaz. Odpovím vám do 24 hodin na uvedený e-mail.
            </p>
            <Button 
              variant="green" 
              onClick={() => setIsSubmitted(false)}
              className="px-6 py-3"
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
        backgroundImage={`${BASE_PATH}/images/hero-background.png`}
        title="Kontakt"
        subtitle="Máte dotaz nebo potřebujete poradit? Rád vám pomůžu."
        overlayOpacity={0.6}
        ariaLabel="Hero sekce kontaktní stránky"
      />

      <main className="py-16 px-5" role="main">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-[45%_55%] gap-12 lg:gap-16">
            
            {/* Levá strana - Osobní informace */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-black mb-6">
                  Napište mi
                </h2>
                <p className="text-gray-700 leading-relaxed mb-8">
                  Jsem Janča a rád odpovím na vaše dotazy. Pokud potřebujete poradit s cestováním, 
                  máte technický problém nebo nápad na spolupráci, neváhejte se ozvat.
                </p>
              </div>

              {/* Kontaktní údaje */}
              <div className="space-y-6">
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
                      <path d="M12.017 1.101c6.04 0 10.935 4.906 10.935 10.952 0 1.854-.462 3.607-1.277 5.136l.788 6.811-6.811-.788c-1.529.815-3.282 1.277-5.136 1.277-6.046 0-10.952-4.895-10.952-10.935 0-6.046 4.906-10.952 10.952-10.952h.501zm5.167 14.695c-.184-.306-.678-.612-1.007-.715-.329-.102-1.906-.941-2.201-1.049-.295-.108-.51-.162-.725.162-.215.324-.836 1.049-1.025 1.267-.189.218-.377.245-.7.081-.323-.164-1.365-.503-2.599-1.603-.96-.857-1.609-1.914-1.798-2.237-.189-.323-.02-.498.142-.659.146-.146.323-.378.485-.567.162-.189.216-.324.324-.54.108-.216.054-.405-.027-.567-.081-.162-.725-1.747-.994-2.393-.262-.629-.532-.543-.725-.551-.189-.008-.405-.008-.621-.008-.216 0-.567.081-.864.405-.295.324-1.127 1.101-1.127 2.686s1.154 3.117 1.316 3.333c.162.216 2.279 3.479 5.52 4.879.771.324 1.374.518 1.845.664.775.246 1.479.211 2.037.128.622-.094 1.906-.779 2.174-1.531.268-.752.268-1.396.189-1.531z"/>
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
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-black mb-6">Napište mi</h3>
                </div>

                <Input
                  label="Jméno"
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Vaše jméno"
                  error={errors.name}
                />

                <Input
                  label="E-mail"
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="vas@email.cz"
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
                  placeholder="Napište mi svůj dotaz..."
                  error={errors.message}
                />

                {/* Odeslat */}
                <div className="pt-4">
                  <Button 
                    type="submit" 
                    variant="green" 
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full justify-center"
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
              </form>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
};

Contact.displayName = 'Contact';

export default Contact;