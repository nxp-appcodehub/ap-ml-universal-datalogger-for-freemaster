/*
 * Copyright 2024 NXP
 * All rights reserved.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Created by: Motion Control & Functional Safety, Roznov, Czechia
 */

#ifndef ML_UNIVERSAL_DATALOGGER_H_
#define ML_UNIVERSAL_DATALOGGER_H_

#include "mlib_FP.h"

#if defined(__cplusplus)
extern "C" {
#endif

// User scenario functions
extern void MLUD_UserCleanUp(void);
extern uint32_t MLUD_UserScenario(void);

// Internally handled functions
void MLUD_Initialize(uint32_t progressTotal);
void MLUD_HandleSamplingEvent(void);

#if defined(__cplusplus)
}
#endif

#endif /* ML_UNIVERSAL_DATALOGGER_H_ */
