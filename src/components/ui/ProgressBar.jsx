import React from 'react';

const ProgressBar = React.memo(({ currentStep, totalSteps, onStepClick }) => {
  // Správný výpočet: mezi kroky jsou mezery, takže (aktuální-1) / (celkem-1)
  const progressPercentage = totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="w-full mb-16">
      {/* Progress Bar with overlaid step indicators */}
      <div className="relative">
        {/* Step indicators positioned absolutely */}
        <div className="absolute -top-3 left-0 right-0 flex justify-between">
          {Array.from({ length: totalSteps }, (_, index) => {
            const stepNumber = index + 1;
            const isCompleted = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            const isClickable = !isCurrent;

            const handleStepClick = () => {
              if (isClickable && onStepClick) {
                onStepClick(stepNumber);
              }
            };

            return (
              <div key={stepNumber} className="flex flex-col items-center">
                {/* Step circle */}
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 border-2
                    ${isCompleted
                      ? 'bg-green-800 text-white border-green-800 cursor-pointer hover:bg-green-900 hover:shadow-lg transform hover:scale-110'
                      : isCurrent
                        ? 'bg-green-800 text-white border-green-800 ring-4 ring-green-300'
                        : 'bg-white text-gray-600 border-gray-300 cursor-pointer hover:bg-green-100 hover:border-green-800 hover:text-green-800 hover:shadow-lg transform hover:scale-110'
                    }
                  `}
                  onClick={handleStepClick}
                >
                  {stepNumber}
                </div>

              </div>
            );
          })}
        </div>

        {/* Background bar */}
        <div className="w-full h-2 bg-gray-200 rounded-full">
          {/* Progress fill */}
          <div
            className="h-2 bg-green-800 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;