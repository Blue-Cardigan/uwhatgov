document.addEventListener('DOMContentLoaded', () => {
    const svgContainer = document.getElementById('svg-container');
    const downloadBtn = document.getElementById('download-btn');
    const controlsContainer = document.getElementById('controls');
    const rotateSlider = document.getElementById('rotate-slider');
    const rotateValueDisplay = document.getElementById('rotate-value');
    const scaleSlider = document.getElementById('scale-slider');
    const scaleValueDisplay = document.getElementById('scale-value');

    let svgElement = null;
    const svgUrl = 'whatsapp-pattern.svg';
    const viewBox = { x: 0, y: 0, width: 200, height: 200 };

    // --- Interaction State Variables ---
    let selectedElement = null;
    let startCoords = { x: 0, y: 0 }; // Mouse/touch position at start of drag (SVG units)
    let initialTransform = { x: 0, y: 0, scale: 1, rotate: 0, rotateCx: 0, rotateCy: 0 }; // Element's transform at start of drag
    let currentElementTransform = null; // Stores the full transform for control updates

    // --- SVG Loading ---
    fetch(svgUrl)
        .then(response => response.text())
        .then(svgText => {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            svgElement = svgDoc.querySelector('svg');

            if (!svgElement) {
                console.error('Failed to parse SVG or SVG element not found');
                svgContainer.innerHTML = '<p>Error loading SVG.</p>';
                return;
            }

            svgElement.setAttribute('width', '100%');
            svgElement.setAttribute('height', '100%');

            svgContainer.innerHTML = '';
            svgContainer.appendChild(svgElement);
            initDraggables();
        })
        .catch(error => {
            console.error('Error loading SVG:', error);
            svgContainer.innerHTML = '<p>Error loading SVG.</p>';
        });

    // --- Download Functionality ---
    downloadBtn.addEventListener('click', () => {
        if (!svgElement) {
            alert('SVG not loaded yet.');
            return;
        }
        if (selectedElement) selectedElement.classList.remove('active-drag'); // Deselect visually

        const svgClone = svgElement.cloneNode(true);
        svgClone.setAttribute('width', viewBox.width);
        svgClone.setAttribute('height', viewBox.height);
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgClone);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited-pattern.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (selectedElement) selectedElement.classList.add('active-drag'); // Re-select visually
    });

    // --- Transform Parsing/Applying Helpers (Unchanged) ---
    function getTransform(element) {
        const transformAttr = element.getAttribute('transform') || '';
        let result = { x: 0, y: 0, scale: 1, rotate: 0, rotateCx: 0, rotateCy: 0 }; // Using 0,0 as default origin now

        const regex = /(\w+)\(([^)]+)\)/g;
        let match;

        while ((match = regex.exec(transformAttr)) !== null) {
            const type = match[1];
            const values = match[2].split(/[ ,\s]+/).map(parseFloat);

            switch (type) {
                case 'translate':
                    result.x = values[0] || 0;
                    result.y = values[1] || 0;
                    break;
                case 'scale':
                    if (values.length >= 1) result.scale = values[0];
                    break;
                case 'rotate':
                    if (values.length >= 1) result.rotate = values[0];
                    if (values.length >= 3) {
                        result.rotateCx = values[1];
                        result.rotateCy = values[2];
                    }
                    break;
            }
        }
        return result;
    }


    function applyTransform(element, t) {
         let transformString = `translate(${t.x.toFixed(3)} ${t.y.toFixed(3)})`;
         if (Math.abs(t.rotate) > 1e-6) {
             transformString += ` rotate(${t.rotate.toFixed(3)} ${t.rotateCx.toFixed(3)} ${t.rotateCy.toFixed(3)})`;
         }
         if (Math.abs(t.scale - 1) > 1e-6) {
             transformString += ` scale(${t.scale.toFixed(3)})`;
         }
        element.setAttribute('transform', transformString.trim());
    }

    // --- Event Listeners Setup ---
    function initDraggables() {
        if (!svgElement) return;
        const draggables = svgElement.querySelectorAll('g');

        draggables.forEach(el => {
            el.addEventListener('mousedown', startDrag); // Renamed from startInteraction
            el.addEventListener('touchstart', startDrag, { passive: false });
        });

        // Separate listener for selection click (without starting drag immediately)
        svgContainer.addEventListener('click', handleClickSelection);


        document.addEventListener('mousemove', handleDrag); // Renamed from handleInteraction
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('mouseleave', endDrag);

        document.addEventListener('touchmove', handleDrag, { passive: false });
        document.addEventListener('touchend', endDrag);
        document.addEventListener('touchcancel', endDrag);

        // Listeners for Controls
        rotateSlider.addEventListener('input', handleRotateChange);
        scaleSlider.addEventListener('input', handleScaleChange);

        // Add listener to deselect when clicking outside
        document.addEventListener('click', handleDeselectClick);

    }

    // --- Coordinate Transformation (Unchanged) ---
     function getSVGPoint(evt) {
        const CTM = svgElement.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };

        let clientX, clientY;
        if (evt.touches && evt.touches.length > 0) {
            clientX = evt.touches[0].clientX;
            clientY = evt.touches[0].clientY;
        } else if (evt.changedTouches && evt.changedTouches.length > 0) {
             clientX = evt.changedTouches[0].clientX;
             clientY = evt.changedTouches[0].clientY;
        } else {
            clientX = evt.clientX;
            clientY = evt.clientY;
        }
        const pt = svgElement.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const svgP = pt.matrixTransform(CTM.inverse());
        return { x: svgP.x, y: svgP.y };
    }

    // --- Control Update Functions ---
    function updateControls(element) {
         currentElementTransform = getTransform(element);

         rotateSlider.value = currentElementTransform.rotate % 360; // Keep value within slider range
         rotateValueDisplay.textContent = parseFloat(rotateSlider.value).toFixed(0);

         scaleSlider.value = currentElementTransform.scale;
         scaleValueDisplay.textContent = parseFloat(scaleSlider.value).toFixed(2);

         rotateSlider.disabled = false;
         scaleSlider.disabled = false;
         controlsContainer.classList.add('element-selected');
    }

    function disableControls() {
         rotateSlider.disabled = true;
         scaleSlider.disabled = true;
         rotateSlider.value = 0;
         scaleSlider.value = 1;
         rotateValueDisplay.textContent = '0';
         scaleValueDisplay.textContent = '1.0';
         controlsContainer.classList.remove('element-selected');
         currentElementTransform = null;
    }

    // --- Selection Logic ---
    function handleClickSelection(evt) {
         // Don't select if clicking on the container background
        if (evt.target === svgContainer || evt.target === svgElement) {
            deselectElement();
            return;
        }

        const targetGroup = evt.target.closest('g');
        if (targetGroup && svgElement.contains(targetGroup)) {
            selectElement(targetGroup);
        } else {
             deselectElement();
        }
    }

    function handleDeselectClick(evt) {
         // If the click is outside the SVG container and controls, deselect
        if (!svgContainer.contains(evt.target) && !controlsContainer.contains(evt.target) && selectedElement) {
             deselectElement();
        }
    }


     function selectElement(element) {
        if (selectedElement && selectedElement !== element) {
           selectedElement.classList.remove('active-drag'); // Deselect previous
        }
        if (selectedElement !== element) {
             selectedElement = element;
             selectedElement.classList.add('active-drag');
             svgElement.appendChild(selectedElement); // Bring to front
             updateControls(selectedElement);
        }
     }

     function deselectElement() {
         if (selectedElement) {
             selectedElement.classList.remove('active-drag');
             selectedElement = null;
             disableControls();
         }
     }


    // --- Interaction Handlers (Drag Only) ---
    function startDrag(evt) {
        // This only starts the *potential* for dragging if mouse moves
        // Selection is now handled by handleClickSelection
        const targetGroup = evt.target.closest('g');
         if (!targetGroup || !svgElement.contains(targetGroup)) return;

        // Prevent default only if dragging might start
        // evt.preventDefault();
        // evt.stopPropagation(); // Allow click to bubble up for selection

        if (selectedElement === targetGroup) { // Only start drag if already selected
            startCoords = getSVGPoint(evt);
            initialTransform = getTransform(selectedElement); // Store transform at drag start
            // No need to set interaction mode, it's always translate
        }
    }

    function handleDrag(evt) {
        // Drag only happens if an element is selected AND the mouse button is down (implicit via mousemove)
        // We check if initialTransform was set in startDrag
        if (selectedElement && initialTransform) {
            evt.preventDefault(); // Prevent text selection, etc. during drag

            const currentCoords = getSVGPoint(evt);
            let dx = currentCoords.x - startCoords.x;
            let dy = currentCoords.y - startCoords.y;

            // Create a temporary transform object for this drag update
            let draggedTransform = { ...currentElementTransform }; // Use the up-to-date transform
            draggedTransform.x = initialTransform.x + dx; // Calculate new position based on drag start
            draggedTransform.y = initialTransform.y + dy;

            // Wrap-around Logic
            if (draggedTransform.x > viewBox.width) draggedTransform.x -= viewBox.width;
            if (draggedTransform.x < 0) draggedTransform.x += viewBox.width;
            if (draggedTransform.y > viewBox.height) draggedTransform.y -= viewBox.height;
            if (draggedTransform.y < 0) draggedTransform.y += viewBox.height;

            applyTransform(selectedElement, draggedTransform);
            // Update the stored transform AFTER applying, so controls reflect drag
            currentElementTransform = getTransform(selectedElement);

        }
    }

    function endDrag(evt) {
        if (selectedElement && initialTransform) { // Only if a drag was in progress
             // Update controls to reflect final dragged position
            updateControls(selectedElement);
        }
         initialTransform = null; // Reset drag start state
        // Don't deselect here, selection persists until explicitly changed
    }

    // --- Control Change Handlers ---
    function handleRotateChange(evt) {
        if (!selectedElement || !currentElementTransform) return;
        const newRotation = parseFloat(evt.target.value);
        rotateValueDisplay.textContent = newRotation.toFixed(0);
        currentElementTransform.rotate = newRotation;
        applyTransform(selectedElement, currentElementTransform);
    }

     function handleScaleChange(evt) {
        if (!selectedElement || !currentElementTransform) return;
        const newScale = parseFloat(evt.target.value);
        scaleValueDisplay.textContent = newScale.toFixed(2);
        currentElementTransform.scale = newScale;
        applyTransform(selectedElement, currentElementTransform);
    }

}); 