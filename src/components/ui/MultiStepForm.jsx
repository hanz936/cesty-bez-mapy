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
      {/* Progress Bar */}
      <ProgressBar
        currentStep={currentStep}
        totalSteps={totalSteps}
        stepLabels={stepLabels}
      />

      {/* Step Content */}
      <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-12 mb-8">
        {/* Step Header */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-green-800 mb-2">
            {currentStepData.title}
          </h2>
          {currentStepData.description && (
            <p className="text-gray-600">
              {currentStepData.description}
            </p>
          )}
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {currentStepData.content}
        </div>

        {/* Navigation */}
        <div className="pt-6 border-t border-gray-200">
          {!isLastStep ? (
            /* Step navigation for non-final steps */
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              {/* Left side - Back button */}
              <div className="flex gap-3">
                {!isFirstStep ? (
                  <Button
                    onClick={handlePrev}
                    variant="green"
                    size="lg"
                    className="px-8"
                  >
                    Zpět
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
                  className="px-8"
                >
                  Další
                </Button>
              </div>
            </div>
          ) : (
            /* Final step layout with centered CTA */
            <div className="space-y-6">
              {/* Back button on separate row */}
              <div className="flex justify-start">
                <Button
                  onClick={handlePrev}
                  variant="green"
                  size="lg"
                  className="px-8"
                >
                  Zpět
                </Button>
              </div>

              {/* Centered main CTA button */}
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