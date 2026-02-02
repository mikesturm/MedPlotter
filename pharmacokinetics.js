/**
 * Methylphenidate Pharmacokinetics Module
 *
 * This module models plasma concentration profiles for various methylphenidate
 * formulations based on FDA prescribing information and published clinical studies.
 *
 * Key references:
 * - FDA Concerta label: Tmax 6-10 hours, ascending profile from OROS
 * - FDA Ritalin LA label: Biphasic with peaks at ~2h and ~5.5h (second higher)
 * - FDA Metadate CD label: 30/70 split with second rise at ~3h
 *
 * The model uses empirically-fitted Bateman functions and profile shapes
 * matched to published PK curves rather than pure theoretical first-order kinetics.
 */

const PharmacoKinetics = (function() {
    'use strict';

    // Methylphenidate base half-life (hours) - used for elimination phase
    const BASE_HALF_LIFE = 3.5;
    const ELIMINATION_RATE = Math.LN2 / BASE_HALF_LIFE;

    /**
     * Bateman function for oral drug absorption
     * Models concentration as: C(t) = A * (e^(-ke*t) - e^(-ka*t))
     * where ka > ke for typical oral absorption
     *
     * @param {number} dose - Dose in mg
     * @param {number} t - Time since dose (hours)
     * @param {number} ka - Absorption rate constant
     * @param {number} ke - Elimination rate constant
     * @returns {number} Relative concentration
     */
    function batemanFunction(dose, t, ka, ke) {
        if (t < 0) return 0;
        if (Math.abs(ka - ke) < 0.001) {
            // Special case when ka ≈ ke
            return dose * ka * t * Math.exp(-ke * t);
        }
        const scalar = ka / (ka - ke);
        return dose * scalar * (Math.exp(-ke * t) - Math.exp(-ka * t));
    }

    /**
     * Calculate the time to peak for a Bateman function
     */
    function batemanTmax(ka, ke) {
        return Math.log(ka / ke) / (ka - ke);
    }

    /**
     * Derive ka from desired Tmax and ke
     * Solved numerically since there's no closed-form solution
     */
    function kaFromTmax(tmax, ke) {
        // Newton-Raphson iteration to find ka
        let ka = 2.0; // Initial guess
        for (let i = 0; i < 20; i++) {
            const currentTmax = batemanTmax(ka, ke);
            const error = currentTmax - tmax;
            if (Math.abs(error) < 0.001) break;
            // Derivative approximation
            const delta = 0.001;
            const dTmax = (batemanTmax(ka + delta, ke) - currentTmax) / delta;
            ka = ka - error / dTmax;
            ka = Math.max(ke + 0.01, ka); // Ensure ka > ke
        }
        return ka;
    }

    /**
     * OROS ascending profile model for Concerta
     * The OROS system releases drug at an increasing rate, creating an ascending
     * plasma concentration that peaks around 6-8 hours post-dose.
     *
     * Models this as: initial IR burst + ascending release component
     */
    function orosConcentration(dose, t, irFraction, tmax) {
        if (t < 0) return 0;

        const ke = ELIMINATION_RATE;
        const irDose = dose * irFraction;
        const orosDose = dose * (1 - irFraction);

        // IR component: peaks at ~1 hour
        const kaIR = kaFromTmax(1.0, ke);
        const irConc = batemanFunction(irDose, t, kaIR, ke);

        // OROS component: ascending release over ~6-7 hours
        // Model as a slower absorption with delayed effective release
        // The OROS pump creates ascending concentrations due to increasing release rate
        let orosConc = 0;

        if (t > 0.5) { // Small lag for OROS to start
            const effectiveT = t - 0.5;
            // Use a very slow absorption to create ascending profile
            // Peak around tmax (6-8 hours from dose, so ~5.5-7.5 from OROS start)
            const kaOROS = kaFromTmax(tmax - 0.5, ke * 0.7); // Slower apparent elimination during absorption
            orosConc = batemanFunction(orosDose, effectiveT, kaOROS, ke);

            // The OROS creates an ascending profile - boost concentration during rise phase
            if (effectiveT < tmax - 0.5) {
                // Ascending phase - concentration rises more steeply
                const riseBoost = 1 + 0.3 * (effectiveT / (tmax - 0.5));
                orosConc *= riseBoost;
            }
        }

        return irConc + orosConc;
    }

    /**
     * Biphasic bead formulation model (Ritalin LA, Metadate CD, Aptensio XR, Focalin XR)
     * Two distinct release pulses with the second pulse typically higher
     */
    function biphasicConcentration(dose, t, irFraction, erDelay, secondPeakHigher = true) {
        if (t < 0) return 0;

        const ke = ELIMINATION_RATE;
        const irDose = dose * irFraction;
        const erDose = dose * (1 - irFraction);

        // First pulse (IR): peaks at ~1.5-2 hours
        const kaIR = kaFromTmax(1.8, ke);
        const irConc = batemanFunction(irDose, t, kaIR, ke);

        // Second pulse (ER): delayed release, peaks ~1.5-2 hours after release
        let erConc = 0;
        if (t > erDelay) {
            const effectiveT = t - erDelay;
            const kaER = kaFromTmax(1.8, ke);
            erConc = batemanFunction(erDose, effectiveT, kaER, ke);

            // Second peak is often higher due to accumulation from first dose
            // and sometimes slower absorption leading to higher Cmax
            if (secondPeakHigher && (1 - irFraction) > irFraction) {
                erConc *= 1.1;
            }
        }

        return irConc + erConc;
    }

    /**
     * Formulation definitions
     * Each includes a custom concentration function matched to FDA PK profiles
     */
    const FORMULATIONS = {
        // ============ IMMEDIATE RELEASE ============
        // Tmax: 1.9 hours, duration: 3-4 hours
        'ir-5': {
            name: 'Immediate Release 5mg',
            dose: 5,
            type: 'ir',
            tmax: 1.9,
            duration: 4
        },
        'ir-10': {
            name: 'Immediate Release 10mg',
            dose: 10,
            type: 'ir',
            tmax: 1.9,
            duration: 4
        },
        'ir-15': {
            name: 'Immediate Release 15mg',
            dose: 15,
            type: 'ir',
            tmax: 1.9,
            duration: 4
        },
        'ir-20': {
            name: 'Immediate Release 20mg',
            dose: 20,
            type: 'ir',
            tmax: 1.9,
            duration: 4
        },

        // ============ RITALIN LA (50% IR / 50% ER) ============
        // SODAS technology: First peak ~2h, second peak ~5.5h (higher than first)
        // Duration: ~8 hours
        'ritalin-la-10': {
            name: 'Ritalin LA 10mg',
            dose: 10,
            type: 'ritalin-la',
            irFraction: 0.5,
            erDelay: 4.0,  // Second release ~4 hours after first
            duration: 8
        },
        'ritalin-la-20': {
            name: 'Ritalin LA 20mg',
            dose: 20,
            type: 'ritalin-la',
            irFraction: 0.5,
            erDelay: 4.0,
            duration: 8
        },
        'ritalin-la-30': {
            name: 'Ritalin LA 30mg',
            dose: 30,
            type: 'ritalin-la',
            irFraction: 0.5,
            erDelay: 4.0,
            duration: 8
        },
        'ritalin-la-40': {
            name: 'Ritalin LA 40mg',
            dose: 40,
            type: 'ritalin-la',
            irFraction: 0.5,
            erDelay: 4.0,
            duration: 8
        },

        // ============ CONCERTA (22% IR / 78% OROS) ============
        // OROS technology: Initial peak ~1h, then ascending to main peak at 6-8h
        // Duration: 12 hours
        'concerta-18': {
            name: 'Concerta 18mg',
            dose: 18,
            type: 'oros',
            irFraction: 0.22,
            tmax: 7,  // Main peak at ~7 hours
            duration: 12
        },
        'concerta-27': {
            name: 'Concerta 27mg',
            dose: 27,
            type: 'oros',
            irFraction: 0.22,
            tmax: 7,
            duration: 12
        },
        'concerta-36': {
            name: 'Concerta 36mg',
            dose: 36,
            type: 'oros',
            irFraction: 0.22,
            tmax: 7,
            duration: 12
        },
        'concerta-54': {
            name: 'Concerta 54mg',
            dose: 54,
            type: 'oros',
            irFraction: 0.22,
            tmax: 7,
            duration: 12
        },

        // ============ METADATE CD (30% IR / 70% ER) ============
        // Diffucaps technology: First peak ~1.5h, second rise ~3h later
        // Duration: ~8 hours
        'metadate-cd-10': {
            name: 'Metadate CD 10mg',
            dose: 10,
            type: 'metadate-cd',
            irFraction: 0.3,
            erDelay: 3.0,
            duration: 8
        },
        'metadate-cd-20': {
            name: 'Metadate CD 20mg',
            dose: 20,
            type: 'metadate-cd',
            irFraction: 0.3,
            erDelay: 3.0,
            duration: 8
        },
        'metadate-cd-30': {
            name: 'Metadate CD 30mg',
            dose: 30,
            type: 'metadate-cd',
            irFraction: 0.3,
            erDelay: 3.0,
            duration: 8
        },
        'metadate-cd-40': {
            name: 'Metadate CD 40mg',
            dose: 40,
            type: 'metadate-cd',
            irFraction: 0.3,
            erDelay: 3.0,
            duration: 8
        },
        'metadate-cd-50': {
            name: 'Metadate CD 50mg',
            dose: 50,
            type: 'metadate-cd',
            irFraction: 0.3,
            erDelay: 3.0,
            duration: 8
        },
        'metadate-cd-60': {
            name: 'Metadate CD 60mg',
            dose: 60,
            type: 'metadate-cd',
            irFraction: 0.3,
            erDelay: 3.0,
            duration: 8
        },

        // ============ APTENSIO XR (40% IR / 60% ER) ============
        // Similar to Ritalin LA but with 40/60 split
        // Duration: ~12 hours
        'aptensio-xr-10': {
            name: 'Aptensio XR 10mg',
            dose: 10,
            type: 'aptensio-xr',
            irFraction: 0.4,
            erDelay: 4.0,
            duration: 12
        },
        'aptensio-xr-15': {
            name: 'Aptensio XR 15mg',
            dose: 15,
            type: 'aptensio-xr',
            irFraction: 0.4,
            erDelay: 4.0,
            duration: 12
        },
        'aptensio-xr-20': {
            name: 'Aptensio XR 20mg',
            dose: 20,
            type: 'aptensio-xr',
            irFraction: 0.4,
            erDelay: 4.0,
            duration: 12
        },
        'aptensio-xr-30': {
            name: 'Aptensio XR 30mg',
            dose: 30,
            type: 'aptensio-xr',
            irFraction: 0.4,
            erDelay: 4.0,
            duration: 12
        },
        'aptensio-xr-40': {
            name: 'Aptensio XR 40mg',
            dose: 40,
            type: 'aptensio-xr',
            irFraction: 0.4,
            erDelay: 4.0,
            duration: 12
        },

        // ============ FOCALIN XR (Dexmethylphenidate 50% IR / 50% ER) ============
        // Dexmethylphenidate is ~2x as potent as racemic methylphenidate
        // Duration: ~12 hours
        'focalin-xr-5': {
            name: 'Focalin XR 5mg',
            dose: 5,
            type: 'focalin-xr',
            irFraction: 0.5,
            erDelay: 4.0,
            potencyFactor: 2.0,
            duration: 12
        },
        'focalin-xr-10': {
            name: 'Focalin XR 10mg',
            dose: 10,
            type: 'focalin-xr',
            irFraction: 0.5,
            erDelay: 4.0,
            potencyFactor: 2.0,
            duration: 12
        },
        'focalin-xr-15': {
            name: 'Focalin XR 15mg',
            dose: 15,
            type: 'focalin-xr',
            irFraction: 0.5,
            erDelay: 4.0,
            potencyFactor: 2.0,
            duration: 12
        },
        'focalin-xr-20': {
            name: 'Focalin XR 20mg',
            dose: 20,
            type: 'focalin-xr',
            irFraction: 0.5,
            erDelay: 4.0,
            potencyFactor: 2.0,
            duration: 12
        },
        'focalin-xr-25': {
            name: 'Focalin XR 25mg',
            dose: 25,
            type: 'focalin-xr',
            irFraction: 0.5,
            erDelay: 4.0,
            potencyFactor: 2.0,
            duration: 12
        },
        'focalin-xr-30': {
            name: 'Focalin XR 30mg',
            dose: 30,
            type: 'focalin-xr',
            irFraction: 0.5,
            erDelay: 4.0,
            potencyFactor: 2.0,
            duration: 12
        },
        'focalin-xr-35': {
            name: 'Focalin XR 35mg',
            dose: 35,
            type: 'focalin-xr',
            irFraction: 0.5,
            erDelay: 4.0,
            potencyFactor: 2.0,
            duration: 12
        },
        'focalin-xr-40': {
            name: 'Focalin XR 40mg',
            dose: 40,
            type: 'focalin-xr',
            irFraction: 0.5,
            erDelay: 4.0,
            potencyFactor: 2.0,
            duration: 12
        },

        // ============ QUILLIVANT XR (20% IR / 80% ER liquid) ============
        // Extended-release liquid suspension
        // Duration: ~12 hours
        'quillivant-xr-20': {
            name: 'Quillivant XR 20mg',
            dose: 20,
            type: 'quillivant-xr',
            irFraction: 0.2,
            erDelay: 2.0,
            duration: 12
        },
        'quillivant-xr-30': {
            name: 'Quillivant XR 30mg',
            dose: 30,
            type: 'quillivant-xr',
            irFraction: 0.2,
            erDelay: 2.0,
            duration: 12
        },
        'quillivant-xr-40': {
            name: 'Quillivant XR 40mg',
            dose: 40,
            type: 'quillivant-xr',
            irFraction: 0.2,
            erDelay: 2.0,
            duration: 12
        },

        // ============ JORNAY PM (Delayed-release for evening dosing) ============
        // Taken at 8 PM, active starting ~10-12 hours later (morning)
        // Duration: ~12 hours from onset
        'jornay-pm-20': {
            name: 'Jornay PM 20mg',
            dose: 20,
            type: 'jornay-pm',
            delayOnset: 10,  // Hours before drug release begins
            duration: 13
        },
        'jornay-pm-40': {
            name: 'Jornay PM 40mg',
            dose: 40,
            type: 'jornay-pm',
            delayOnset: 10,
            duration: 13
        },
        'jornay-pm-60': {
            name: 'Jornay PM 60mg',
            dose: 60,
            type: 'jornay-pm',
            delayOnset: 10,
            duration: 13
        },
        'jornay-pm-80': {
            name: 'Jornay PM 80mg',
            dose: 80,
            type: 'jornay-pm',
            delayOnset: 10,
            duration: 13
        },
        'jornay-pm-100': {
            name: 'Jornay PM 100mg',
            dose: 100,
            type: 'jornay-pm',
            delayOnset: 10,
            duration: 13
        }
    };

    /**
     * Calculate plasma concentration at a given time for a specific formulation
     *
     * @param {string} formulationKey - Key of the formulation
     * @param {number} timeFromDose - Hours since dose administration
     * @returns {number} Relative plasma concentration (mg equivalent)
     */
    function calculateMedicationConcentration(formulationKey, timeFromDose) {
        const formulation = FORMULATIONS[formulationKey];
        if (!formulation) return 0;
        if (timeFromDose < 0) return 0;

        const ke = ELIMINATION_RATE;
        let concentration = 0;

        switch (formulation.type) {
            case 'ir': {
                // Immediate release: simple Bateman function
                const ka = kaFromTmax(formulation.tmax, ke);
                concentration = batemanFunction(formulation.dose, timeFromDose, ka, ke);
                break;
            }

            case 'oros': {
                // Concerta OROS: ascending profile
                concentration = orosConcentration(
                    formulation.dose,
                    timeFromDose,
                    formulation.irFraction,
                    formulation.tmax
                );
                break;
            }

            case 'ritalin-la': {
                // Ritalin LA: 50/50 biphasic, second peak higher
                concentration = biphasicConcentration(
                    formulation.dose,
                    timeFromDose,
                    formulation.irFraction,
                    formulation.erDelay,
                    true  // Second peak higher
                );
                break;
            }

            case 'metadate-cd': {
                // Metadate CD: 30/70 biphasic
                concentration = biphasicConcentration(
                    formulation.dose,
                    timeFromDose,
                    formulation.irFraction,
                    formulation.erDelay,
                    true  // Second peak higher due to larger ER portion
                );
                break;
            }

            case 'aptensio-xr': {
                // Aptensio XR: 40/60 biphasic
                concentration = biphasicConcentration(
                    formulation.dose,
                    timeFromDose,
                    formulation.irFraction,
                    formulation.erDelay,
                    true
                );
                break;
            }

            case 'focalin-xr': {
                // Focalin XR: 50/50 biphasic (dexmethylphenidate)
                concentration = biphasicConcentration(
                    formulation.dose,
                    timeFromDose,
                    formulation.irFraction,
                    formulation.erDelay,
                    true
                );
                // Apply potency factor for dexmethylphenidate
                concentration *= formulation.potencyFactor;
                break;
            }

            case 'quillivant-xr': {
                // Quillivant XR: 20/80 with extended release profile
                // More gradual second release
                const irDose = formulation.dose * formulation.irFraction;
                const erDose = formulation.dose * (1 - formulation.irFraction);

                // IR component
                const kaIR = kaFromTmax(1.5, ke);
                concentration = batemanFunction(irDose, timeFromDose, kaIR, ke);

                // ER component: slower, more sustained release
                if (timeFromDose > formulation.erDelay) {
                    const effectiveT = timeFromDose - formulation.erDelay;
                    // Slower absorption for sustained effect
                    const kaER = kaFromTmax(4.0, ke);
                    concentration += batemanFunction(erDose, effectiveT, kaER, ke);
                }
                break;
            }

            case 'jornay-pm': {
                // Jornay PM: delayed onset, then extended release profile
                const delay = formulation.delayOnset;

                if (timeFromDose < delay) {
                    concentration = 0;
                } else {
                    const effectiveT = timeFromDose - delay;
                    // After delay, behaves like an extended-release
                    // Initial burst followed by sustained release
                    const irDose = formulation.dose * 0.3;
                    const erDose = formulation.dose * 0.7;

                    const kaIR = kaFromTmax(2.0, ke);
                    concentration = batemanFunction(irDose, effectiveT, kaIR, ke);

                    if (effectiveT > 1) {
                        const kaER = kaFromTmax(4.0, ke);
                        concentration += batemanFunction(erDose, effectiveT - 1, kaER, ke);
                    }
                }
                break;
            }

            default:
                concentration = 0;
        }

        return Math.max(0, concentration);
    }

    /**
     * Calculate total concentration from a stack of medications at a given time
     *
     * @param {Array} medications - Array of {formulation, doseTimeHours}
     * @param {number} currentTimeHours - Time in hours from reference point
     * @returns {number} Total concentration in mg equivalent
     */
    function calculateStackConcentration(medications, currentTimeHours) {
        let totalConcentration = 0;

        for (const med of medications) {
            const timeFromDose = currentTimeHours - med.doseTimeHours;

            if (timeFromDose >= 0) {
                totalConcentration += calculateMedicationConcentration(med.formulation, timeFromDose);
            }
        }

        return totalConcentration;
    }

    /**
     * Generate hour-by-hour concentration data for a stack
     *
     * @param {Array} medications - Array of {formulation, doseTimeHours}
     * @param {number} startHour - Starting hour (0-23)
     * @param {number} hours - Number of hours to calculate
     * @returns {Array} Array of {hour, hoursFromStart, concentration} objects
     */
    function generateConcentrationTimeline(medications, startHour, hours) {
        const timeline = [];

        for (let i = 0; i <= hours; i++) {
            const currentHour = (startHour + i) % 24;
            const concentration = calculateStackConcentration(medications, startHour + i);

            timeline.push({
                hour: currentHour,
                hoursFromStart: i,
                concentration: Math.round(concentration * 100) / 100
            });
        }

        return timeline;
    }

    /**
     * Get formulation info by key
     */
    function getFormulation(key) {
        return FORMULATIONS[key];
    }

    /**
     * Get all available formulations
     */
    function getAllFormulations() {
        return Object.entries(FORMULATIONS).map(([key, value]) => ({
            key,
            ...value
        }));
    }

    // Public API
    return {
        calculateMedicationConcentration,
        calculateStackConcentration,
        generateConcentrationTimeline,
        getFormulation,
        getAllFormulations,
        ELIMINATION_RATE,
        BASE_HALF_LIFE
    };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PharmacoKinetics;
}
