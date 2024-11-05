/*
 * Copyright 2024 NXP
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Created by Motion Control & Functional Safety Team, Roznov, Czechia
 */

#include <ml_universal_datalogger.h>

#define MLUD_STATUS_IDLE 		0
#define MLUD_STATUS_ENABLED 	1
#define MLUD_STATUS_RESET 		2

static uint8_t mlud_status = MLUD_STATUS_IDLE;
static uint32_t mlud_progressCurrent = 0;
static uint32_t mlud_progressTotal = 0;

void MLUD_Initialize(uint32_t progressTotal)
{
	// Make sure the variables are used (to appear in FreeMaster)
	mlud_status = MLUD_STATUS_IDLE;
	mlud_progressTotal = progressTotal;
}

void MLUD_HandleSamplingEvent(void)
{
	// Check for reset
	if(mlud_status == MLUD_STATUS_RESET)
	{
		// Clear progress
		mlud_progressCurrent = 0;

		// Reset all values
		MLUD_UserCleanUp();

		// Reset flag
		mlud_status = MLUD_STATUS_IDLE;
	}

	// Is enabled?
	if(mlud_status == MLUD_STATUS_ENABLED)
	{
		mlud_progressCurrent = MLUD_UserScenario();
		if(mlud_progressCurrent >= mlud_progressTotal)
		{
			mlud_status = MLUD_STATUS_IDLE;
		}
	}
}
