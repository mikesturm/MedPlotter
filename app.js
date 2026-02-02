/**
 * MedPlotter - Main Application
 * Handles UI interactions, data collection, and visualization
 */

(function() {
    'use strict';

    // Application state
    const state = {
        stacks: [],
        nextStackId: 1,
        nextMedicationId: 1,
        chart: null
    };

    // Color palette for chart lines (distinct, colorblind-friendly)
    const CHART_COLORS = [
        '#4a90d9',  // Blue
        '#e74c3c',  // Red
        '#2ecc71',  // Green
        '#9b59b6',  // Purple
        '#f39c12',  // Orange
        '#1abc9c',  // Teal
        '#e91e63',  // Pink
        '#795548',  // Brown
        '#607d8b',  // Blue Grey
        '#ff5722'   // Deep Orange
    ];

    // DOM Elements
    const elements = {
        stacksContainer: document.getElementById('stacks-container'),
        addStackBtn: document.getElementById('add-stack-btn'),
        plotBtn: document.getElementById('plot-btn'),
        resultsSection: document.getElementById('results-section'),
        resultsTable: document.getElementById('results-table'),
        chartCanvas: document.getElementById('medication-chart'),
        stackTemplate: document.getElementById('stack-template'),
        medicationTemplate: document.getElementById('medication-template')
    };

    /**
     * Initialize the application
     */
    function init() {
        // Add event listeners
        elements.addStackBtn.addEventListener('click', addStack);
        elements.plotBtn.addEventListener('click', plotStacks);

        // Add initial stack
        addStack();
    }

    /**
     * Add a new stack to the UI
     */
    function addStack() {
        const stackId = state.nextStackId++;
        const stackElement = elements.stackTemplate.content.cloneNode(true);
        const stackCard = stackElement.querySelector('.stack-card');

        stackCard.dataset.stackId = stackId;
        stackCard.querySelector('.stack-name-input').value = `Stack ${stackId}`;

        // Add event listeners
        stackCard.querySelector('.remove-stack-btn').addEventListener('click', () => removeStack(stackId));
        stackCard.querySelector('.add-medication-btn').addEventListener('click', () => addMedication(stackId));

        elements.stacksContainer.appendChild(stackElement);

        // Add initial medication
        addMedication(stackId);

        // Update state
        state.stacks.push({
            id: stackId,
            name: `Stack ${stackId}`,
            medications: []
        });

        updatePlotButton();
    }

    /**
     * Remove a stack from the UI
     */
    function removeStack(stackId) {
        const stackCard = document.querySelector(`.stack-card[data-stack-id="${stackId}"]`);
        if (stackCard) {
            stackCard.remove();
        }

        // Update state
        state.stacks = state.stacks.filter(s => s.id !== stackId);

        updatePlotButton();

        // If no stacks left, add one
        if (state.stacks.length === 0) {
            addStack();
        }
    }

    /**
     * Add a medication to a stack
     */
    function addMedication(stackId) {
        const stackCard = document.querySelector(`.stack-card[data-stack-id="${stackId}"]`);
        if (!stackCard) return;

        const medicationsContainer = stackCard.querySelector('.medications-container');
        const medicationId = state.nextMedicationId++;
        const medicationElement = elements.medicationTemplate.content.cloneNode(true);
        const medicationRow = medicationElement.querySelector('.medication-row');

        medicationRow.dataset.medicationId = medicationId;
        medicationRow.dataset.stackId = stackId;

        // Add event listener for remove button
        medicationRow.querySelector('.remove-medication-btn').addEventListener('click', () => {
            removeMedication(stackId, medicationId);
        });

        medicationsContainer.appendChild(medicationElement);
        updatePlotButton();
    }

    /**
     * Remove a medication from a stack
     */
    function removeMedication(stackId, medicationId) {
        const medicationRow = document.querySelector(
            `.medication-row[data-stack-id="${stackId}"][data-medication-id="${medicationId}"]`
        );

        if (medicationRow) {
            const medicationsContainer = medicationRow.closest('.medications-container');
            medicationRow.remove();

            // If no medications left in stack, add one
            if (medicationsContainer.children.length === 0) {
                addMedication(stackId);
            }
        }

        updatePlotButton();
    }

    /**
     * Update the plot button state
     */
    function updatePlotButton() {
        const hasStacks = document.querySelectorAll('.stack-card').length > 0;
        const hasMedications = document.querySelectorAll('.medication-row').length > 0;
        elements.plotBtn.disabled = !(hasStacks && hasMedications);
    }

    /**
     * Convert 12-hour time to 24-hour decimal
     */
    function convertTo24Hour(hour, minute, ampm) {
        let h = parseInt(hour);
        const m = parseInt(minute);

        if (ampm === 'AM') {
            if (h === 12) h = 0;
        } else {
            if (h !== 12) h += 12;
        }

        return h + (m / 60);
    }

    /**
     * Format hour for display (12-hour format)
     */
    function formatHour(hour24) {
        const h = hour24 % 24;
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h === 0 ? 12 : (h > 12 ? h - 12 : h);
        return `${displayHour}:00 ${period}`;
    }

    /**
     * Collect stack data from the UI
     */
    function collectStackData() {
        const stackCards = document.querySelectorAll('.stack-card');
        const stacks = [];

        stackCards.forEach((card, index) => {
            const stackId = card.dataset.stackId;
            const stackName = card.querySelector('.stack-name-input').value || `Stack ${index + 1}`;
            const medications = [];

            const medicationRows = card.querySelectorAll('.medication-row');
            medicationRows.forEach(row => {
                const formulation = row.querySelector('.formulation-select').value;
                const hour = row.querySelector('.hour-select').value;
                const minute = row.querySelector('.minute-select').value;
                const ampm = row.querySelector('.ampm-select').value;

                const doseTimeHours = convertTo24Hour(hour, minute, ampm);

                medications.push({
                    formulation,
                    doseTimeHours,
                    displayTime: `${hour}:${minute} ${ampm}`
                });
            });

            stacks.push({
                id: stackId,
                name: stackName,
                medications,
                color: CHART_COLORS[index % CHART_COLORS.length]
            });
        });

        return stacks;
    }

    /**
     * Find the earliest dose time across all stacks
     */
    function findEarliestDoseTime(stacks) {
        let earliest = 24;

        stacks.forEach(stack => {
            stack.medications.forEach(med => {
                if (med.doseTimeHours < earliest) {
                    earliest = med.doseTimeHours;
                }
            });
        });

        return Math.floor(earliest);
    }

    /**
     * Calculate hours until midnight the next day
     */
    function calculateHoursUntilMidnight(startHour) {
        // From start hour to midnight next day (24:00 + any hours before midnight)
        const hoursUntilMidnight = 24 - startHour;
        return Math.min(hoursUntilMidnight, 24);
    }

    /**
     * Generate concentration data for all stacks
     */
    function generateAllStackData(stacks, startHour, hours) {
        return stacks.map(stack => {
            const timeline = PharmacoKinetics.generateConcentrationTimeline(
                stack.medications,
                startHour,
                hours
            );

            return {
                ...stack,
                timeline
            };
        });
    }

    /**
     * Plot the stacks
     */
    function plotStacks() {
        const stacks = collectStackData();

        if (stacks.length === 0) {
            alert('Please add at least one stack with medications.');
            return;
        }

        const startHour = findEarliestDoseTime(stacks);
        const hours = calculateHoursUntilMidnight(startHour);

        const stackData = generateAllStackData(stacks, startHour, hours);

        // Show results section
        elements.resultsSection.classList.remove('hidden');

        // Generate chart and table
        renderChart(stackData, startHour, hours);
        renderTable(stackData, startHour, hours);

        // Scroll to results
        elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Render the concentration chart
     */
    function renderChart(stackData, startHour, hours) {
        // Generate labels (hours)
        const labels = [];
        for (let i = 0; i <= hours; i++) {
            const hour = (startHour + i) % 24;
            labels.push(formatHour(hour));
        }

        // Generate datasets
        const datasets = stackData.map(stack => ({
            label: stack.name,
            data: stack.timeline.map(point => point.concentration),
            borderColor: stack.color,
            backgroundColor: stack.color + '20',
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: stack.color,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            fill: false,
            tension: 0.3
        }));

        // Destroy existing chart if it exists
        if (state.chart) {
            state.chart.destroy();
        }

        // Create new chart
        const ctx = elements.chartCanvas.getContext('2d');
        state.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Methylphenidate Concentration Over Time',
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 15,
                        cornerRadius: 8,
                        callbacks: {
                            title: function(tooltipItems) {
                                return tooltipItems[0].label;
                            },
                            label: function(context) {
                                const stackName = context.dataset.label;
                                const value = context.parsed.y.toFixed(2);
                                return `${stackName}: ${value} mg`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time of Day',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            padding: 10
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            maxRotation: 45,
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Amount in System (mg equivalent)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            padding: 10
                        },
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                size: 12
                            },
                            callback: function(value) {
                                return value.toFixed(1) + ' mg';
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render the data table
     */
    function renderTable(stackData, startHour, hours) {
        const thead = elements.resultsTable.querySelector('thead');
        const tbody = elements.resultsTable.querySelector('tbody');

        // Clear existing content
        thead.innerHTML = '';
        tbody.innerHTML = '';

        // Create header row
        const headerRow = document.createElement('tr');
        const timeHeader = document.createElement('th');
        timeHeader.textContent = 'Time';
        headerRow.appendChild(timeHeader);

        stackData.forEach(stack => {
            const th = document.createElement('th');
            th.textContent = stack.name;
            th.style.backgroundColor = stack.color;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);

        // Create data rows
        for (let i = 0; i <= hours; i++) {
            const row = document.createElement('tr');
            const hour = (startHour + i) % 24;

            // Time cell
            const timeCell = document.createElement('td');
            timeCell.textContent = formatHour(hour);
            row.appendChild(timeCell);

            // Stack concentration cells
            stackData.forEach(stack => {
                const cell = document.createElement('td');
                const concentration = stack.timeline[i]?.concentration || 0;
                cell.textContent = concentration.toFixed(2);

                // Add visual indicator based on concentration
                const maxConc = Math.max(...stack.timeline.map(p => p.concentration));
                const intensity = maxConc > 0 ? (concentration / maxConc) : 0;
                cell.style.backgroundColor = `rgba(${hexToRgb(stack.color)}, ${intensity * 0.3})`;

                row.appendChild(cell);
            });

            tbody.appendChild(row);
        }
    }

    /**
     * Convert hex color to RGB values
     */
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ?
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
            '0, 0, 0';
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
