/**
 * Methylphenidate Pharmacokinetics Module
 *
 * This module contains pharmacokinetic data and calculations for various
 * methylphenidate formulations. Data is based on published research and
 * FDA prescribing information.
 *
 * Key pharmacokinetic parameters for methylphenidate:
 * - Oral bioavailability: ~30% (varies 10-52%)
 * - Half-life: 2-3 hours (d-methylphenidate), 1-4 hours (l-methylphenidate)
 * - Time to peak varies by formulation
 * - First-order absorption and elimination kinetics
 */

const PharmacoKinetics = (function() {
    'use strict';

    // Base half-life for methylphenidate (hours)
    const BASE_HALF_LIFE = 3.0;

    // Elimination rate constant (ke = ln(2) / t1/2)
    const ELIMINATION_RATE = Math.LN2 / BASE_HALF_LIFE;

    /**
     * Formulation definitions with pharmacokinetic parameters
     * Each formulation has:
     * - name: Display name
     * - dose: Total dose in mg
     * - components: Array of release components, each with:
     *   - fraction: Fraction of total dose (0-1)
     *   - tmax: Time to peak concentration (hours)
     *   - absorptionRate: Rate constant for absorption (1/hours)
     *   - delay: Delay before release begins (hours)
     *   - duration: For sustained release, duration over which drug is released
     */
    const FORMULATIONS = {
        // Immediate Release
        'ir-5': {
            name: 'Immediate Release 5mg',
            dose: 5,
            type: 'ir',
            components: [
                { fraction: 1.0, tmax: 1.9, absorptionRate: 2.5, delay: 0 }
            ]
        },
        'ir-10': {
            name: 'Immediate Release 10mg',
            dose: 10,
            type: 'ir',
            components: [
                { fraction: 1.0, tmax: 1.9, absorptionRate: 2.5, delay: 0 }
            ]
        },
        'ir-15': {
            name: 'Immediate Release 15mg',
            dose: 15,
            type: 'ir',
            components: [
                { fraction: 1.0, tmax: 1.9, absorptionRate: 2.5, delay: 0 }
            ]
        },
        'ir-20': {
            name: 'Immediate Release 20mg',
            dose: 20,
            type: 'ir',
            components: [
                { fraction: 1.0, tmax: 1.9, absorptionRate: 2.5, delay: 0 }
            ]
        },

        // Ritalin LA (50% IR beads / 50% delayed-release beads)
        // Second pulse releases approximately 4 hours after first
        'ritalin-la-10': {
            name: 'Ritalin LA 10mg',
            dose: 10,
            type: 'biphasic',
            components: [
                { fraction: 0.5, tmax: 1.9, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.9, absorptionRate: 2.5, delay: 4 }
            ]
        },
        'ritalin-la-20': {
            name: 'Ritalin LA 20mg',
            dose: 20,
            type: 'biphasic',
            components: [
                { fraction: 0.5, tmax: 1.9, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.9, absorptionRate: 2.5, delay: 4 }
            ]
        },
        'ritalin-la-30': {
            name: 'Ritalin LA 30mg',
            dose: 30,
            type: 'biphasic',
            components: [
                { fraction: 0.5, tmax: 1.9, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.9, absorptionRate: 2.5, delay: 4 }
            ]
        },
        'ritalin-la-40': {
            name: 'Ritalin LA 40mg',
            dose: 40,
            type: 'biphasic',
            components: [
                { fraction: 0.5, tmax: 1.9, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.9, absorptionRate: 2.5, delay: 4 }
            ]
        },

        // Concerta (OROS - 22% IR overcoat / 78% osmotic-controlled release)
        // Initial peak at ~1-2 hours, then ascending plateau over 6-10 hours
        'concerta-18': {
            name: 'Concerta 18mg',
            dose: 18,
            type: 'oros',
            components: [
                { fraction: 0.22, tmax: 1.5, absorptionRate: 3.0, delay: 0 },
                { fraction: 0.78, tmax: 7.0, absorptionRate: 0.4, delay: 1, sustained: true, duration: 10 }
            ]
        },
        'concerta-27': {
            name: 'Concerta 27mg',
            dose: 27,
            type: 'oros',
            components: [
                { fraction: 0.22, tmax: 1.5, absorptionRate: 3.0, delay: 0 },
                { fraction: 0.78, tmax: 7.0, absorptionRate: 0.4, delay: 1, sustained: true, duration: 10 }
            ]
        },
        'concerta-36': {
            name: 'Concerta 36mg',
            dose: 36,
            type: 'oros',
            components: [
                { fraction: 0.22, tmax: 1.5, absorptionRate: 3.0, delay: 0 },
                { fraction: 0.78, tmax: 7.0, absorptionRate: 0.4, delay: 1, sustained: true, duration: 10 }
            ]
        },
        'concerta-54': {
            name: 'Concerta 54mg',
            dose: 54,
            type: 'oros',
            components: [
                { fraction: 0.22, tmax: 1.5, absorptionRate: 3.0, delay: 0 },
                { fraction: 0.78, tmax: 7.0, absorptionRate: 0.4, delay: 1, sustained: true, duration: 10 }
            ]
        },

        // Metadate CD (30% IR / 70% ER beads)
        // Second release at approximately 4.5 hours
        'metadate-cd-10': {
            name: 'Metadate CD 10mg',
            dose: 10,
            type: 'biphasic',
            components: [
                { fraction: 0.3, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.7, tmax: 1.5, absorptionRate: 2.0, delay: 4.5 }
            ]
        },
        'metadate-cd-20': {
            name: 'Metadate CD 20mg',
            dose: 20,
            type: 'biphasic',
            components: [
                { fraction: 0.3, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.7, tmax: 1.5, absorptionRate: 2.0, delay: 4.5 }
            ]
        },
        'metadate-cd-30': {
            name: 'Metadate CD 30mg',
            dose: 30,
            type: 'biphasic',
            components: [
                { fraction: 0.3, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.7, tmax: 1.5, absorptionRate: 2.0, delay: 4.5 }
            ]
        },
        'metadate-cd-40': {
            name: 'Metadate CD 40mg',
            dose: 40,
            type: 'biphasic',
            components: [
                { fraction: 0.3, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.7, tmax: 1.5, absorptionRate: 2.0, delay: 4.5 }
            ]
        },
        'metadate-cd-50': {
            name: 'Metadate CD 50mg',
            dose: 50,
            type: 'biphasic',
            components: [
                { fraction: 0.3, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.7, tmax: 1.5, absorptionRate: 2.0, delay: 4.5 }
            ]
        },
        'metadate-cd-60': {
            name: 'Metadate CD 60mg',
            dose: 60,
            type: 'biphasic',
            components: [
                { fraction: 0.3, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.7, tmax: 1.5, absorptionRate: 2.0, delay: 4.5 }
            ]
        },

        // Aptensio XR (40% IR / 60% ER beads)
        // Second release at approximately 4 hours
        'aptensio-xr-10': {
            name: 'Aptensio XR 10mg',
            dose: 10,
            type: 'biphasic',
            components: [
                { fraction: 0.4, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.6, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'aptensio-xr-15': {
            name: 'Aptensio XR 15mg',
            dose: 15,
            type: 'biphasic',
            components: [
                { fraction: 0.4, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.6, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'aptensio-xr-20': {
            name: 'Aptensio XR 20mg',
            dose: 20,
            type: 'biphasic',
            components: [
                { fraction: 0.4, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.6, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'aptensio-xr-30': {
            name: 'Aptensio XR 30mg',
            dose: 30,
            type: 'biphasic',
            components: [
                { fraction: 0.4, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.6, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'aptensio-xr-40': {
            name: 'Aptensio XR 40mg',
            dose: 40,
            type: 'biphasic',
            components: [
                { fraction: 0.4, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.6, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },

        // Focalin XR (Dexmethylphenidate - more potent isomer)
        // 50% IR / 50% ER beads, second release at ~4 hours
        // Note: Dexmethylphenidate is roughly 2x potent as racemic methylphenidate
        'focalin-xr-5': {
            name: 'Focalin XR 5mg',
            dose: 5,
            type: 'biphasic',
            isDex: true,
            potencyFactor: 2.0,
            components: [
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'focalin-xr-10': {
            name: 'Focalin XR 10mg',
            dose: 10,
            type: 'biphasic',
            isDex: true,
            potencyFactor: 2.0,
            components: [
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'focalin-xr-15': {
            name: 'Focalin XR 15mg',
            dose: 15,
            type: 'biphasic',
            isDex: true,
            potencyFactor: 2.0,
            components: [
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'focalin-xr-20': {
            name: 'Focalin XR 20mg',
            dose: 20,
            type: 'biphasic',
            isDex: true,
            potencyFactor: 2.0,
            components: [
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'focalin-xr-25': {
            name: 'Focalin XR 25mg',
            dose: 25,
            type: 'biphasic',
            isDex: true,
            potencyFactor: 2.0,
            components: [
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'focalin-xr-30': {
            name: 'Focalin XR 30mg',
            dose: 30,
            type: 'biphasic',
            isDex: true,
            potencyFactor: 2.0,
            components: [
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'focalin-xr-35': {
            name: 'Focalin XR 35mg',
            dose: 35,
            type: 'biphasic',
            isDex: true,
            potencyFactor: 2.0,
            components: [
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },
        'focalin-xr-40': {
            name: 'Focalin XR 40mg',
            dose: 40,
            type: 'biphasic',
            isDex: true,
            potencyFactor: 2.0,
            components: [
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.5, tmax: 1.5, absorptionRate: 2.0, delay: 4 }
            ]
        },

        // Quillivant XR (Liquid extended-release)
        // 20% IR / 80% ER
        'quillivant-xr-20': {
            name: 'Quillivant XR 20mg',
            dose: 20,
            type: 'extended',
            components: [
                { fraction: 0.2, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.8, tmax: 5.0, absorptionRate: 0.6, delay: 0.5, sustained: true, duration: 8 }
            ]
        },
        'quillivant-xr-30': {
            name: 'Quillivant XR 30mg',
            dose: 30,
            type: 'extended',
            components: [
                { fraction: 0.2, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.8, tmax: 5.0, absorptionRate: 0.6, delay: 0.5, sustained: true, duration: 8 }
            ]
        },
        'quillivant-xr-40': {
            name: 'Quillivant XR 40mg',
            dose: 40,
            type: 'extended',
            components: [
                { fraction: 0.2, tmax: 1.5, absorptionRate: 2.5, delay: 0 },
                { fraction: 0.8, tmax: 5.0, absorptionRate: 0.6, delay: 0.5, sustained: true, duration: 8 }
            ]
        },

        // Jornay PM (Delayed-release for evening dosing)
        // Designed to be taken at 8 PM, effects begin next morning
        // 10-12 hour delay before release, then behaves like extended-release
        'jornay-pm-20': {
            name: 'Jornay PM 20mg',
            dose: 20,
            type: 'delayed',
            components: [
                { fraction: 0.3, tmax: 2.0, absorptionRate: 2.0, delay: 10 },
                { fraction: 0.7, tmax: 4.0, absorptionRate: 0.8, delay: 10, sustained: true, duration: 8 }
            ]
        },
        'jornay-pm-40': {
            name: 'Jornay PM 40mg',
            dose: 40,
            type: 'delayed',
            components: [
                { fraction: 0.3, tmax: 2.0, absorptionRate: 2.0, delay: 10 },
                { fraction: 0.7, tmax: 4.0, absorptionRate: 0.8, delay: 10, sustained: true, duration: 8 }
            ]
        },
        'jornay-pm-60': {
            name: 'Jornay PM 60mg',
            dose: 60,
            type: 'delayed',
            components: [
                { fraction: 0.3, tmax: 2.0, absorptionRate: 2.0, delay: 10 },
                { fraction: 0.7, tmax: 4.0, absorptionRate: 0.8, delay: 10, sustained: true, duration: 8 }
            ]
        },
        'jornay-pm-80': {
            name: 'Jornay PM 80mg',
            dose: 80,
            type: 'delayed',
            components: [
                { fraction: 0.3, tmax: 2.0, absorptionRate: 2.0, delay: 10 },
                { fraction: 0.7, tmax: 4.0, absorptionRate: 0.8, delay: 10, sustained: true, duration: 8 }
            ]
        },
        'jornay-pm-100': {
            name: 'Jornay PM 100mg',
            dose: 100,
            type: 'delayed',
            components: [
                { fraction: 0.3, tmax: 2.0, absorptionRate: 2.0, delay: 10 },
                { fraction: 0.7, tmax: 4.0, absorptionRate: 0.8, delay: 10, sustained: true, duration: 8 }
            ]
        }
    };

    /**
     * Calculate plasma concentration at a given time for a single dose component
     * Using a one-compartment model with first-order absorption and elimination
     *
     * C(t) = (F * D * ka / Vd * (ka - ke)) * (e^(-ke*t) - e^(-ka*t))
     *
     * Simplified for relative concentration (normalized):
     * C(t) = dose * ka/(ka-ke) * (e^(-ke*t) - e^(-ka*t))
     */
    function calculateComponentConcentration(dose, component, timeFromDose) {
        const t = timeFromDose - component.delay;

        // Before release begins
        if (t < 0) return 0;

        const ka = component.absorptionRate;
        const ke = ELIMINATION_RATE;

        if (component.sustained) {
            // For sustained release, model as continuous infusion during release period
            // then first-order elimination after
            return calculateSustainedReleaseConcentration(dose, component, t);
        }

        // Avoid numerical issues when ka ≈ ke
        if (Math.abs(ka - ke) < 0.001) {
            return dose * ka * t * Math.exp(-ke * t);
        }

        // Standard one-compartment oral absorption model
        const concentration = dose * (ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));

        return Math.max(0, concentration);
    }

    /**
     * Calculate concentration for sustained-release components
     * Models drug release as occurring over a specified duration
     */
    function calculateSustainedReleaseConcentration(dose, component, t) {
        const duration = component.duration || 8;
        const ke = ELIMINATION_RATE;

        // Release rate (mg/hour)
        const releaseRate = dose / duration;

        if (t <= duration) {
            // During release: accumulating drug
            // Integral of infusion with elimination
            const concentration = (releaseRate / ke) * (1 - Math.exp(-ke * t));
            return concentration;
        } else {
            // After release complete: elimination only
            const peakConc = (releaseRate / ke) * (1 - Math.exp(-ke * duration));
            const timeAfterPeak = t - duration;
            return peakConc * Math.exp(-ke * timeAfterPeak);
        }
    }

    /**
     * Calculate total plasma concentration at a given time for a medication
     * (sum of all components)
     */
    function calculateMedicationConcentration(formulationKey, timeFromDose) {
        const formulation = FORMULATIONS[formulationKey];
        if (!formulation) return 0;

        let totalConcentration = 0;

        for (const component of formulation.components) {
            const componentDose = formulation.dose * component.fraction;
            totalConcentration += calculateComponentConcentration(componentDose, component, timeFromDose);
        }

        // Apply potency factor for dexmethylphenidate
        // This represents equivalent mg of racemic methylphenidate
        if (formulation.potencyFactor) {
            totalConcentration *= formulation.potencyFactor;
        }

        return totalConcentration;
    }

    /**
     * Calculate total concentration from a stack of medications at a given time
     *
     * @param {Array} medications - Array of {formulation, doseTimeHours}
     * @param {number} currentTimeHours - Time in hours (0-24, where 0 is midnight)
     * @returns {number} Total concentration in mg equivalent
     */
    function calculateStackConcentration(medications, currentTimeHours) {
        let totalConcentration = 0;

        for (const med of medications) {
            const timeFromDose = currentTimeHours - med.doseTimeHours;

            // Handle overnight calculations (if dose time is after current time)
            // This can happen if dose was taken the previous day
            const adjustedTime = timeFromDose < 0 ? timeFromDose + 24 : timeFromDose;

            // Only count if medication has been taken
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
     * @returns {Array} Array of {hour, concentration} objects
     */
    function generateConcentrationTimeline(medications, startHour, hours) {
        const timeline = [];

        for (let i = 0; i <= hours; i++) {
            const currentHour = (startHour + i) % 24;
            const concentration = calculateStackConcentration(medications, startHour + i);

            timeline.push({
                hour: currentHour,
                hoursFromStart: i,
                concentration: Math.round(concentration * 100) / 100 // Round to 2 decimal places
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
