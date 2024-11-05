/*
 * Copyright 2024 NXP
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Created by Motion Control & Functional Safety Team, Roznov, Czechia
 */

#include "pin_mux.h"
#include "peripherals.h"
#include "board.h"
#include "mlib_FP.h"
#include "gflib_FP.h"
#include "fsl_lptmr.h"
#include "ml_universal_datalogger.h"

/*******************************************************************************
 * Definitions
 ******************************************************************************/

#define ML_TIMER_PERIOD_US 1000
#define ML_READ_BUFFER_TOTAL_SIZE 10000

typedef enum {
	ML_MYAPP_STATE_UNKNOWN = -1,
	ML_MYAPP_STATE_OFF = 0,
	ML_MYAPP_STATE_ON,
	ML_MYAPP_STATE_FAULT
} ml_myAppStates_t;

/*******************************************************************************
 * Prototypes
 ******************************************************************************/
void ML_InitializeTimer(void);

/*******************************************************************************
 * Variables
 ******************************************************************************/
// Application specific variables
ml_myAppStates_t ml_myAppState = 0;
float_t ml_myAppSpeed = 0;
uint32_t ml_myRequiredSpeed = 0;
uint32_t ml_msTimer = 0;

// Buffer variables
float_t ml_xBuffer[ML_READ_BUFFER_TOTAL_SIZE] = {0};
frac16_t ml_yBuffer[ML_READ_BUFFER_TOTAL_SIZE] = {0};

// Scenario variables
uint32_t ml_bufferIndex = 0;

/*******************************************************************************
 * Code
 ******************************************************************************/

// Timer initialization where in its interrupt the sampling will happen
void ML_InitializeTimer(void)
{
    /* Enables the clk_16k[1] */
    CLOCK_SetupClk16KClocking(kCLOCK_Clk16KToVsys);

	/* Configure LPTMR */
	lptmr_config_t lptmrConfig;
	LPTMR_GetDefaultConfig(&lptmrConfig);

	/* Initialize the LPTMR */
	LPTMR_Init(LPTMR0, &lptmrConfig);

	/* Set timer period */
	LPTMR_SetTimerPeriod(LPTMR0, USEC_TO_COUNT(ML_TIMER_PERIOD_US, 16000));

	/* Enable timer interrupt */
	LPTMR_EnableInterrupts(LPTMR0, kLPTMR_TimerInterruptEnable);

	/* Enable at the NVIC */
	EnableIRQ(LPTMR0_IRQn);

	/* Start counting */
	LPTMR_StartTimer(LPTMR0);
}

// Timer interrupt handler
void LPTMR0_IRQHandler(void)
{
	// Clear timer interrupt flag
	LPTMR_ClearStatusFlags(LPTMR0, kLPTMR_TimerCompareFlag);

	// Simulate my control variable
	ml_myAppSpeed = (ml_myAppState == ML_MYAPP_STATE_ON) ? (500.0F + (10.0F * GFLIB_Sin_FLT(ml_msTimer++))) : 0.0F;

	// Handle timer event internally and let user know via callback functions
	MLUD_HandleSamplingEvent();

	// Blink LED
	GPIO_PortToggle(BOARD_LED_RED_GPIO, 1u << BOARD_LED_RED_GPIO_PIN);
}

/*
 * Here you reset all variables before new measurement starts.
 * If cleaning is time consuming, consider using flags and perform
 * cleaning in main loop to avoid instability of timer interrupt.
 */
void MLUD_UserCleanUp(void)
{
	ml_bufferIndex = 0;
}

// In this function the scenario is implemented.
uint32_t MLUD_UserScenario(void)
{
	// If app is enabled
	if (ml_myAppState == ML_MYAPP_STATE_ON)
	{
		// If buffer is not full
		if(ml_bufferIndex < ML_READ_BUFFER_TOTAL_SIZE)
		{
			// Save data to buffers
			ml_xBuffer[ml_bufferIndex] = ml_myAppSpeed;
			ml_yBuffer[ml_bufferIndex] = MLIB_ConvSc_F16ff_FAsmi(ml_myAppSpeed, 1000.0F);

			// Increment buffer (and progress)
			ml_bufferIndex++;
		}
	}

	// Return current progress value (in this case it is buffer size)
	return ml_bufferIndex;
}

/*!
 * @brief Main function
 */
int main(void)
{
	// Initialize board
	BOARD_InitBootPins();
    BOARD_InitBootClocks();
	BOARD_InitBootPeripherals();
	BOARD_BootClockFRO12M();

	// Prepare LED
	CLOCK_EnableClock(kCLOCK_Gpio0);
	LED_RED_INIT(LOGIC_LED_ON);

	// Initialize RTCESL PQ (to enable GFLIB_Sin_FLT function)
	RTCESL_PQ_Init();

	// Just use it here to make sure, it will included in map file
	ml_myAppState = 0;
	ml_myAppSpeed = 0;
	ml_myRequiredSpeed = 0;
	ml_msTimer = 0;

	/*
	 * Initialize datalogger with progress size.
	 * In this case we use size of our buffer, but end of measurement
	 * does not have to be aligned with capacity of measurement buffer.
	 * For example you can save some indices or other asynchronous events.
	 */
	MLUD_Initialize(ML_READ_BUFFER_TOTAL_SIZE);

	// Prepare timer
	ML_InitializeTimer();

	while (1)
	{
		FMSTR_Poll();
	}
}
