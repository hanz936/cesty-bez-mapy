import React, { useState, useCallback } from 'react';
import { Button } from './index';
import ProgressBar from './ProgressBar';

const MultiStepForm = React.memo(({
  steps,
  stepLabels = [],
  onComplete,
  onStepChange,
  className = ''
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = steps.length;


  const handleNext = useCallback(() => {
    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);
      // Delay scroll until after DOM update
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
      });
    }
  }, [currentStep, totalSteps, onStepChange]);

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);
      // Delay scroll until after DOM update
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
      });
    }
  }, [currentStep, onStepChange]);

  const handleComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  const currentStepData = steps[currentStep - 1];
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className={`w-full ${className}`.trim()}>
      {/* Single Unified Container */}
      <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-12 mb-8">
        {/* Progress Bar - Inside Container */}
        <div className="mb-8">
          <ProgressBar
            currentStep={currentStep}
            totalSteps={totalSteps}
            stepLabels={stepLabels}
          />
        </div>


        {/* Single Column Layout Inside Container */}
        <div className="mb-8">
          {/* Intro text only on first step */}
          {currentStep === 1 && (
            <div className="text-center mb-12">
              <h1 className="text-3xl sm:text-4xl font-bold text-green-800 mb-4">
                Tvůj cestovní profil
              </h1>
              <p className="text-lg text-black max-w-3xl mx-auto mb-3">
                Stačí 5 jednoduchých kroků a já ti připravím itinerář přesně podle tvých představ
              </p>
              <p className="text-sm text-gray-500 mb-8">
                Pole označená <span className="text-red-500">*</span> jsou povinná k vyplnění
              </p>
            </div>
          )}

          {/* Step Header */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-green-800 mb-2">
              {currentStepData.title}
            </h2>
            {currentStepData.description && (
              <p className="text-black mb-6">
                {currentStepData.description}
              </p>
            )}
            <div className="border-t border-gray-200 mb-10"></div>
          </div>

          {/* Step Content */}
          <div className="mb-8">
            {currentStepData.content}
          </div>
        </div>

        {/* Navigation - Full Width Across Container */}
        <div className="pt-12">
          {!isLastStep ? (
            /* Step navigation for non-final steps - spanning full width */
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center w-full">
              {/* Left side - Back button */}
              <div className="flex gap-3">
                {!isFirstStep ? (
                  <Button
                    onClick={handlePrev}
                    variant="green"
                    size="lg"
                    className="group px-8 relative overflow-hidden w-full sm:w-auto"
                  >
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 rotate-180" fill="currentColor" viewBox="0 0 512 512">
                      <path d="M186.62,464H160a16,16,0,0,1-14.57-22.6l64.46-142.25L113.1,297,77.8,339.77C71.07,348.23,65.7,352,52,352H34.08a17.66,17.66,0,0,1-14.7-7.06c-2.38-3.21-4.72-8.65-2.44-16.41l19.82-71c.15-.53.33-1.06.53-1.58a.38.38,0,0,0,0-.15,14.82,14.82,0,0,1-.53-1.59L16.92,182.76c-2.15-7.61.2-12.93,2.56-16.06a16.83,16.83,0,0,1,13.6-6.7H52c10.23,0,20.16,4.59,26,12l34.57,42.05,97.32-1.44-64.44-142A16,16,0,0,1,160,48h26.91a25,25,0,0,1,19.35,9.8l125.05,152,57.77-1.52c4.23-.23,15.95-.31,18.66-.31C463,208,496,225.94,496,256c0,9.46-3.78,27-29.07,38.16-14.93,6.6-34.85,9.94-59.21,9.94-2.68,0-14.37-.08-18.66-.31l-57.76-1.54-125.36,152A25,25,0,0,1,186.62,464Z"/>
                    </svg>
                    <span className="transition-transform duration-300 group-hover:translate-x-4">
                      Jdeme zpět
                    </span>
                  </Button>
                ) : (
                  <div></div>
                )}
              </div>

              {/* Right side - Next button */}
              <div className="flex gap-3">
                <Button
                  onClick={handleNext}
                  variant="green"
                  size="lg"
                  className="group px-8 relative overflow-hidden w-full sm:w-auto"
                >
                  <span className="transition-transform duration-300 group-hover:-translate-x-4">
                    Jdeme dál
                  </span>
                  <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300" fill="currentColor" viewBox="0 0 512 512">
                    <path d="M186.62,464H160a16,16,0,0,1-14.57-22.6l64.46-142.25L113.1,297,77.8,339.77C71.07,348.23,65.7,352,52,352H34.08a17.66,17.66,0,0,1-14.7-7.06c-2.38-3.21-4.72-8.65-2.44-16.41l19.82-71c.15-.53.33-1.06.53-1.58a.38.38,0,0,0,0-.15,14.82,14.82,0,0,1-.53-1.59L16.92,182.76c-2.15-7.61.2-12.93,2.56-16.06a16.83,16.83,0,0,1,13.6-6.7H52c10.23,0,20.16,4.59,26,12l34.57,42.05,97.32-1.44-64.44-142A16,16,0,0,1,160,48h26.91a25,25,0,0,1,19.35,9.8l125.05,152,57.77-1.52c4.23-.23,15.95-.31,18.66-.31C463,208,496,225.94,496,256c0,9.46-3.78,27-29.07,38.16-14.93,6.6-34.85,9.94-59.21,9.94-2.68,0-14.37-.08-18.66-.31l-57.76-1.54-125.36,152A25,25,0,0,1,186.62,464Z"/>
                  </svg>
                </Button>
              </div>
            </div>
          ) : (
            /* Final step layout - back button on first row, CTA centered on second row */
            <div className="space-y-6">
              {/* First row - Back button on the left */}
              <div className="flex justify-start">
                <Button
                  onClick={handlePrev}
                  variant="green"
                  size="lg"
                  className="group px-8 relative overflow-hidden w-full sm:w-auto"
                >
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 rotate-180" fill="currentColor" viewBox="0 0 512 512">
                    <path d="M186.62,464H160a16,16,0,0,1-14.57-22.6l64.46-142.25L113.1,297,77.8,339.77C71.07,348.23,65.7,352,52,352H34.08a17.66,17.66,0,0,1-14.7-7.06c-2.38-3.21-4.72-8.65-2.44-16.41l19.82-71c.15-.53.33-1.06.53-1.58a.38.38,0,0,0,0-.15,14.82,14.82,0,0,1-.53-1.59L16.92,182.76c-2.15-7.61.2-12.93,2.56-16.06a16.83,16.83,0,0,1,13.6-6.7H52c10.23,0,20.16,4.59,26,12l34.57,42.05,97.32-1.44-64.44-142A16,16,0,0,1,160,48h26.91a25,25,0,0,1,19.35,9.8l125.05,152,57.77-1.52c4.23-.23,15.95-.31,18.66-.31C463,208,496,225.94,496,256c0,9.46-3.78,27-29.07,38.16-14.93,6.6-34.85,9.94-59.21,9.94-2.68,0-14.37-.08-18.66-.31l-57.76-1.54-125.36,152A25,25,0,0,1,186.62,464Z"/>
                  </svg>
                  <span className="transition-transform duration-300 group-hover:translate-x-4">
                    Jdeme zpět
                  </span>
                </Button>
              </div>

              {/* Second row - Main CTA button centered */}
              <div className="flex justify-center">
                <Button
                  onClick={handleComplete}
                  variant="green"
                  size="xl"
                  className="px-16 w-full sm:w-auto"
                >
                  Přidat do košíku
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

MultiStepForm.displayName = 'MultiStepForm';

export default MultiStepForm;