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
      // Smooth scroll to top when moving to next step
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep, totalSteps, onStepChange]);

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);
      // Smooth scroll to top when moving to previous step
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

        {/* Two Column Layout Inside Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left Column - Form Content */}
          <div>
            {/* Step Header */}
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-green-800 mb-2">
                {currentStepData.title}
              </h2>
              {currentStepData.description && (
                <p className="text-black">
                  {currentStepData.description}
                </p>
              )}
            </div>

            {/* Step Content */}
            <div className="mb-8">
              {currentStepData.content}
            </div>
          </div>

          {/* Right Column - Image Placeholders */}
          <div className="hidden lg:block">
            <div className="flex flex-col h-full justify-center items-center space-y-6">
              {/* Placeholder 1 */}
              <div className="w-full h-48 bg-gray-100 rounded-2xl flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">Inspirační obrázek</p>
                </div>
              </div>

              {/* Placeholder 2 */}
              <div className="w-full h-48 bg-gray-100 rounded-2xl flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                  </svg>
                  <p className="text-sm text-gray-500">Cestovní destinace</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation - Full Width Across Container */}
        <div className="pt-6 border-t border-gray-200">
          {!isLastStep ? (
            /* Step navigation for non-final steps - spanning full width */
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              {/* Left side - Back button */}
              <div className="flex gap-3">
                {!isFirstStep ? (
                  <Button
                    onClick={handlePrev}
                    variant="green"
                    size="lg"
                    className="group px-8 relative overflow-hidden"
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
                  className="group px-8 relative overflow-hidden"
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
                  className="group px-8 relative overflow-hidden"
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
                  className="px-16"
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