import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { Button, Form, Input, TextArea } from '../components/ui';
import { BASE_PATH } from '../constants';
import logger from '../utils/logger';

const CLASSES = {
  main: 'min-h-screen bg-white',
  section: 'py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8',
  grid: 'flex flex-col lg:flex-row lg:flex-wrap justify-center items-center max-w-6xl mx-auto gap-8 lg:gap-10',
  textContent: 'flex-1 lg:min-w-80 text-sm sm:text-base lg:text-lg text-black leading-relaxed text-left order-1',
  heading: 'text-3xl lg:text-4xl font-bold text-black mb-6',
  subheading: 'text-xl lg:text-2xl font-semibold text-black mt-8 mb-4',
  paragraph: 'mb-6',
  list: 'list-disc ml-6 space-y-3 marker:text-green-800 marker:text-lg',
  sampleImage: 'flex-1 lg:min-w-80 text-center order-2',
  sampleImageInner: 'w-full max-w-sm sm:max-w-md rounded-xl shadow-2xl bg-gray-100 mx-auto flex items-center justify-center text-black text-lg border border-gray-200 aspect-[4/5]',
  contactSection: 'bg-white py-12 lg:py-16 mt-16',
  contactContainer: 'max-w-2xl mx-auto px-4 sm:px-6 lg:px-8',
  contactCard: 'bg-gradient-to-br from-gray-50 to-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 md:p-8',
  errorMessage: 'text-red-600 text-sm mt-1',
  successMessage: 'bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6'
};


const Collaboration = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const validateForm = useCallback((data) => {
    const errors = {};
    
    if (!data.name.trim()) {
      errors.name = 'Jméno je povinné';
    }
    
    if (!data.email.trim()) {
      errors.email = 'E-mail je povinný';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'E-mail není ve správném formátu';
    }
    
    if (!data.message.trim()) {
      errors.message = 'Zpráva je povinná';
    } else if (data.message.trim().length < 10) {
      errors.message = 'Zpráva musí mít alespoň 10 znaků';
    }
    
    return errors;
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    setFormErrors(prev => {
      if (prev[name]) {
        const { [name]: _, ...rest } = prev;
        return rest;
      }
      return prev;
    });
    
    if (submitSuccess) {
      setSubmitSuccess(false);
    }
  }, [submitSuccess]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSubmitSuccess(true);
      setFormData({ name: '', email: '', message: '' });
      setFormErrors({});
    } catch (error) {
      logger.error('Form submission error:', error, { formData: { email: formData.email } });
      setFormErrors({ submit: 'Při odesílání se vyskytla chyba. Zkuste to prosím znovu.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm]);


  return (
    <Layout>
      <PageHero 
        backgroundImage={`${BASE_PATH}/images/hero-background-collaboration.png`}
        title="Spolupráce"
        subtitle="UGC obsah z reálného cestování – uvěřitelný, použitelný a účinný."
        overlayOpacity={0.6}
        ariaLabel="Hero sekce stránky Spolupráce"
      />
      
      <section 
        className={CLASSES.section}
        role="main"
        aria-labelledby="collaboration-heading"
      >
        <div className={CLASSES.grid}>
          <div className={CLASSES.textContent}>
            <div id="collaboration-heading" className="sr-only">Spolupráce - UGC travel obsah</div>
            <header>
              <h1 className={CLASSES.heading}>
                Spolupráce se mnou jako UGC travel tvůrcem
              </h1>
            </header>
            
            <p className={CLASSES.paragraph}>
              Hledáš autentický a poutavý obsah, který zaujme cestovatele a zároveň působí přirozeně?
            </p>
            
            <p className={CLASSES.paragraph}>
              Tvořím UGC obsah z reálného cestování – videa, fotky i recenze, které oslovují lidi právě proto, že nejsou přehnaně stylizované. Jsou uvěřitelné, použitelné a účinné. Takové, jaký dnešní publikum opravdu sleduje.
            </p>
            
            <section aria-labelledby="ideal-collaboration">
              <h2 id="ideal-collaboration" className={CLASSES.subheading}>
                Pro koho je spolupráce ideální:
              </h2>
              <ul className={CLASSES.list} role="list">
                <li role="listitem">Hotely, penziony, glampingy</li>
                <li role="listitem">Značky outdoor vybavení a cestovních doplňků</li>
                <li role="listitem">Cestovní aplikace, portály, vyhledávače</li>
                <li role="listitem">Turistické destinace, regiony nebo města, které chtějí přiblížit svou atmosféru</li>
              </ul>
            </section>
            
            <section aria-labelledby="service-offerings">
              <h2 id="service-offerings" className={CLASSES.subheading}>
                Co konkrétně nabízím:
              </h2>
              <ul className={CLASSES.list} role="list">
                <li role="listitem">Krátká videa z cest (např. formáty pro Reels, stories apod.)</li>
                <li role="listitem">Fotografie na míru – destinace, produkty, služby</li>
                <li role="listitem">Recenze ubytování, aplikací nebo zážitků v reálném cestovatelském prostředí</li>
                <li role="listitem">Obsah ideální pro propagaci cestovatelských produktů či služeb (ať už jsi hotel, značka nebo region)</li>
              </ul>
            </section>
            
            <section aria-labelledby="my-style">
              <h2 id="my-style" className={CLASSES.subheading}>
                Můj styl:
              </h2>
              <p className={CLASSES.paragraph}>
                Miluju přirozené záběry z reálného prostředí. Nepoužívám ateliér ani přehnané filtry – fotky a videa jsou autentické, ale vizuálně silné.
              </p>
              
              <p className={CLASSES.paragraph}>
                Ukazuju, jak to opravdu vypadá – tak, aby se v tom lidé našli a chtěli vyrazit taky.
              </p>
              
              <p className="font-bold mb-3">
                Zaujalo tě to? Ráda ti připravím obsah na míru, ať už máš konkrétní zadání, nebo chceš pomoct s nápadem od nuly.
              </p>
              
              <p className="font-bold">
                Napiš mi a probereme detaily.
              </p>
            </section>
          </div>
          
          <div className={CLASSES.sampleImage}>
            <div className={CLASSES.sampleImageInner}>
              <p>Ukázka UGC obsahu</p>
            </div>
          </div>
        </div>
      </section>
      
      <section className={CLASSES.contactSection} aria-labelledby="contact-form">
        <div className={CLASSES.contactContainer}>
          <div className={CLASSES.contactCard}>
            
            {submitSuccess && (
              <div className={CLASSES.successMessage} role="alert">
                Děkuji za zprávu! Odpovím ti co nejdříve.
              </div>
            )}
            
            <Form onSubmit={handleSubmit} spacing="lg" noValidate>
              <Input
                label="Jméno"
                required
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Tvé jméno"
                error={formErrors.name}
              />
              
              <Input
                label="E-mail"
                required
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="tvuj@email.cz"
                error={formErrors.email}
              />
              
              <TextArea
                label="Zpráva"
                required
                id="message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                placeholder="Napiš mi, na čem bychom spolupracovali..."
                rows={6}
                error={formErrors.message}
              />
              
              {formErrors.submit && (
                <div className={CLASSES.errorMessage} role="alert">
                  {formErrors.submit}
                </div>
              )}
              
              <div className="flex justify-center">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="green"
                  size="md"
                  className="disabled:bg-gray-400 disabled:cursor-not-allowed"
                  aria-describedby="submit-button-help"
                >
                  {isSubmitting ? 'Odesílám...' : 'Odeslat zprávu'}
                </Button>
              </div>
              <p id="submit-button-help" className="sr-only">
                Kliknutím odešlete kontaktní formulář
              </p>
            </Form>
          </div>
        </div>
      </section>
    </Layout>
  );
};

Collaboration.displayName = 'Collaboration';

export default Collaboration;