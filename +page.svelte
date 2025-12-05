<script>
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onDestroy, onMount } from 'svelte';

    // --- PAGE DATA (server-provided) ---
    /** @type {import('./$types').PageData} */
    export let data;

    // safe access to params
    const chapterId = $page?.params?.id ?? '1';
    const totalVerses = 47;

    // make robust against different server shapes
    let chapterData = Array.isArray(data?.chapterData) ? data.chapterData : [];

    // If server returned an error object, just log (do not use alert during SSR)
    if (data?.error) {
        console.error('Server-side error message:', data.message);
    }

    // UI state
    let showModal = false;
    let modalContent = {}; // { chapter, verse, textHTML, audioUrl }

    // Recording / canvas / audio state
    let canvasEl;
    let audioEl; // bound to <audio> in modal
    let recorder = null;
    let recordedChunks = [];
    let recordedVideoUrl = '';
    let recording = false;
    let visualOnly = false;
    let renderInterval = null;

    // Verse tiles
    const verseTiles = [
        { id: 'whole', label: 'Whole Chapter' },
        ...Array.from({ length: totalVerses }, (_, i) => ({ id: String(i + 1), label: String(i + 1) }))
    ];

    function goBack() {
        goto('/');
    }

    // Helper: build absolute URL (api sometimes returns relative paths)
    function makeAbsoluteUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url;
        // ensure no duplicate slashes
        return `https://sanskrit.ie/${url.replace(/^\/+/, '')}`;
    }

    // Choose verse object property flexibly
    function getVerseText(verseObj) {
        // possible fields: lyrics (HTML), shlok (HTML/text), shlok_text, text, shlok_no etc.
        return verseObj?.lyrics ?? verseObj?.shlok ?? verseObj?.shlok_text ?? verseObj?.text ?? '';
    }

    function getVerseAudioPath(verseObj) {
        // possible fields: music, audio, audio_url, music_path
        return verseObj?.music ?? verseObj?.audio ?? verseObj?.audio_url ?? verseObj?.music_path ?? '';
    }

    // Open modal for a chosen verse
    function handlePlayVerse(verseId) {
        if (verseId === 'whole' || verseId === 'end') {
            // not implemented behavior is kept
            console.info(`"${verseId}" functionality not implemented yet.`);
            return;
        }

        if (!chapterData || chapterData.length === 0) {
            console.error('No chapter data available to play verse.');
            showModal = false;
            return;
        }

        const target = chapterData.find(v => String(v.shlok_no ?? v.shlok_no ?? v.geeta_id ?? v.id) === verseId
            || String(v.shlok_no) === verseId
            || String(v.geeta_id) === verseId);

        // fallback: if not found by id, try index (verseId as 1-based index)
        let targetVerse = target;
        if (!target && Number(verseId) && chapterData.length >= Number(verseId)) {
            targetVerse = chapterData[Number(verseId) - 1];
        }

        if (!targetVerse) {
            console.error(`Verse ${verseId} not found. chapterData length: ${chapterData.length}`);
            return;
        }

        // Build modalContent using flexible getters
        const textHTML = getVerseText(targetVerse) || 'No text available.';
        const audioPath = getVerseAudioPath(targetVerse) || '';
        modalContent = {
            chapter: chapterId,
            verse: targetVerse.shlok_no ?? targetVerse.shlok_no ?? (targetVerse.geeta_id ?? verseId),
            textHTML,
            audioUrl: audioPath ? makeAbsoluteUrl(audioPath) : ''
        };

        // reset previous recording preview
        if (recordedVideoUrl) {
            URL.revokeObjectURL(recordedVideoUrl);
            recordedVideoUrl = '';
        }

        showModal = true;

        // Wait for modal DOM to mount and audioEl to bind
        // this is safe to call only in browser
        setTimeout(() => {
            // set audio src on the bound audioEl (if present)
            prepareAudioElement();
            // start static rendering (not recording yet) so canvas shows text while modal open
            startCanvasRendering();
            // focus modal for accessibility
            const modal = document.querySelector('.verse-modal-content');
            if (modal) modal.focus();
        }, 60);
    }

    function closeModal() {
        stopRecordingIfActive();
        showModal = false;
        modalContent = {};
        stopCanvasRendering();
        if (recordedVideoUrl) {
            URL.revokeObjectURL(recordedVideoUrl);
            recordedVideoUrl = '';
        }
    }

    function handleCloseKey(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    }

    // --- Audio element setup ---
    function prepareAudioElement() {
        if (!audioEl) {
            // audioEl may not be bound yet
            return;
        }

        // if there's a previous source playing, pause it
        try {
            if (audioEl && typeof audioEl.pause === 'function') audioEl.pause();
        } catch (e) {}

        if (!modalContent?.audioUrl) {
            // clear src if none
            if (audioEl) {
                audioEl.removeAttribute('src');
                audioEl.load?.();
            }
            return;
        }

        audioEl.crossOrigin = 'anonymous';
        audioEl.src = modalContent.audioUrl;
        audioEl.preload = 'auto';
        // do not autoplay here; recording triggers play
        try { audioEl.load(); } catch(e) {}
        // when audio ends, stop recording if active
        audioEl.onended = () => {
            if (recording) {
                stopRecording();
            }
        };
    }

    // --- Canvas rendering helpers ---
    function extractPlainTextFromHTML(html) {
        if (!html) return '';
        // In browser, use DOMParser for safer extraction
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            // preserve newlines between block elements
            function toText(node) {
                if (!node) return '';
                if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
                let txt = '';
                node.childNodes.forEach(child => {
                    txt += toText(child);
                    if (child.nodeName === 'P' || child.nodeName === 'DIV' || child.nodeName === 'BR') {
                        txt += '\n';
                    }
                });
                return txt;
            }
            const raw = toText(doc.body).replace(/\u00A0/g, ' ');
            return raw.replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
        } catch (e) {
            // fallback: strip tags
            return html.replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim();
        }
    }

    function splitTextToLines(ctx, text, maxWidth, fontSize = 20, fontFamily = 'serif') {
        ctx.font = `${fontSize}px ${fontFamily}`;
        const words = text.split(/\s+/);
        const lines = [];
        let line = '';
        for (let i = 0; i < words.length; i++) {
            const test = line ? line + ' ' + words[i] : words[i];
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = words[i];
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    function roundRect(ctx, x, y, w, h, r, fill = '#fff', stroke = null) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }

    function startCanvasRendering() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    const W = canvasEl.width = 1280;
    const H = canvasEl.height = 720;

    const fullText = extractPlainTextFromHTML(modalContent.textHTML || '');
    const lines = splitTextToLines(ctx, fullText, W - 200, 30, "'Playfair Display'");

    let t = 0;
    stopCanvasRendering();

    renderInterval = setInterval(() => {
        t += 1 / 30;

        /* ---------- BACKGROUND (Same as screenshot) ---------- */
        const gradient = ctx.createLinearGradient(0, 0, W, H);
        gradient.addColorStop(0, "#fdf4e8");
        gradient.addColorStop(1, "#f6dec3");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);

        /* ---------- CENTER CARD ---------- */
        const pad = 70;
        const boxW = W - pad * 2;
        const boxH = H - pad * 2;

        // soft shadow
        ctx.shadowColor = "rgba(0,0,0,0.15)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 6;

        roundRect(ctx, pad, pad, boxW, boxH, 28, "#ffffff", "#e2c7b0");

        // clear shadow for text after card
        ctx.shadowColor = "transparent";

        /* ---------- HEADING (MATCHES SCREENSHOT STYLE) ---------- */
        ctx.fillStyle = "#a03a31";
        ctx.font = "34px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.fillText(
            `Chapter ${modalContent.chapter}  •  Verse ${modalContent.verse}`,
            W / 2,
            pad + 60
        );

        /* ---------- BODY TEXT (DARK BROWN LIKE SCREENSHOT) ---------- */
        ctx.fillStyle = "#4a2b24";
        ctx.font = "26px 'Playfair Display', serif";
        ctx.textAlign = "left";

        const textX = pad + 60;
        const startY = pad + 120;

        const lineHeight = 40;

        for (let i = 0; i < lines.length; i++) {
            const y = startY + i * lineHeight;
            if (y > pad + boxH - 60) break;
            ctx.fillText(lines[i], textX, y);
        }

        /* ---------- BOTTOM DECORATIVE BAR (like screenshot) ---------- */
        ctx.fillStyle = "#edd9c6";
        ctx.fillRect(pad + 50, H - pad - 60, boxW - 100, 4);

    }, 1000 / 30);
}


    function stopCanvasRendering() {
        if (renderInterval) {
            clearInterval(renderInterval);
            renderInterval = null;
        }
    }

    // --- Recording logic (unchanged behavior, robust) ---
    async function startRecording() {
        if (recording) return;
        if (!canvasEl) {
            console.warn('Canvas not ready.');
            return;
        }

        // ensure audio element has been prepared
        prepareAudioElement();

        if (!audioEl || !modalContent.audioUrl) {
            visualOnly = true;
            console.info('Recording visual-only (no audio source).');
        } else {
            visualOnly = false;
        }

        // start the visible rendering
        startCanvasRendering();

        // capture streams
        const canvasStream = canvasEl.captureStream(30);
        let combinedStream = canvasStream;

        // try to capture audio from the <audio> element
        let audioStream = null;
        if (audioEl && typeof audioEl.captureStream === 'function') {
            try { audioStream = audioEl.captureStream(); } catch (e) { console.warn(e); }
        }

        if (audioStream && audioStream.getAudioTracks().length > 0) {
            combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
        } else if (audioEl) {
            // fallback: use AudioContext to route audio into a destination stream
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioCtx.createMediaElementSource(audioEl);
                const dest = audioCtx.createMediaStreamDestination();
                source.connect(dest);
                source.connect(audioCtx.destination);
                const destStream = dest.stream;
                if (destStream.getAudioTracks().length) {
                    combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...destStream.getAudioTracks()]);
                } else {
                    console.warn('No audio tracks in AudioContext destination.');
                }
            } catch (e) {
                console.warn('AudioContext fallback failed:', e);
            }
        }

        recordedChunks = [];
        let options = { mimeType: 'video/webm;codecs=vp9,opus' };
        try { recorder = new MediaRecorder(combinedStream, options); }
        catch (err) {
            try { recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' }); }
            catch (err2) { recorder = new MediaRecorder(combinedStream); }
        }

        recorder.ondataavailable = (e) => { if (e.data && e.data.size) recordedChunks.push(e.data); };
        recorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
            recordedVideoUrl = URL.createObjectURL(blob);
            stopCanvasRendering();
            recording = false;
        };

        recorder.start(100);
        recording = true;

        // play audio (if available). May require user gesture in some browsers.
        if (audioEl) {
            try { await audioEl.play(); } catch (e) { console.warn('Audio play blocked until user gesture.', e); }
        }

        // safety timeout (3 minutes)
        setTimeout(() => { if (recording) stopRecording(); }, 1000 * 60 * 3);
    }

    function stopRecording() {
        if (!recording) return;
        if (recorder && recorder.state !== 'inactive') {
            try { recorder.stop(); } catch (e) { console.warn(e); }
        }
        if (audioEl && !audioEl.paused) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }
        recording = false;
    }

    function stopRecordingIfActive() {
        if (recording) stopRecording();
        stopCanvasRendering();
        if (audioEl && document.body.contains(audioEl)) {
            try {
                audioEl.pause();
                audioEl.src = '';
                audioEl.remove();
            } catch (e) { /* ignore */ }
            audioEl = null;
        }
    }

    function downloadRecordedVideo() {
        if (!recordedVideoUrl) return alert('No recorded video yet.');
        const a = document.createElement('a');
        a.href = recordedVideoUrl;
        a.download = `chapter-${modalContent.chapter}-verse-${modalContent.verse}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    onDestroy(() => {
        stopRecordingIfActive();
    });

    // small client-side safety: if the server returned error, show a console message on mount
    onMount(() => {
        if (data?.error) {
            console.warn('Server reported an error loading chapter data:', data.message);
        }
    });

    
</script>


<main class="chapter-content-area">
    <a href="/" on:click|preventDefault={goBack} class="back-link" title="Go back to chapters">← Back</a>

    <div class="verse-page-visual-container">
        <div class="section-title-area">
            <h1 class="chapter-title-red">CHAPTER {chapterId}</h1>
            <hr class="divider-line chapter-divider" />
        </div>

        <div class="verse-title-area">
            <h2 class="verse-heading-red">Verse</h2>
            <hr class="divider-line verse-divider" />
        </div>

        {#if !chapterData || chapterData.length === 0}
            <p style="text-align:center; font-size:1.1em; color:#c0392b;">
                No verses found for this chapter. The API returned an unexpected format or no data.
            </p>
        {:else}
            <section class="verse-tiles-grid" aria-label="Verse tiles">
                {#each verseTiles as tile}
                    {#if tile.id === 'whole'}
                        <!-- render 'whole' as a smaller special button -->
                        <button class="scroll-tile special" type="button" on:click={() => handlePlayVerse(tile.id)}>
                            <span class="scroll-label">{tile.label}</span>
                        </button>
                    {:else}
                        <!-- Make each tile a real <button> for accessibility -->
                        <button class="scroll-tile" type="button" on:click={() => handlePlayVerse(tile.id)} aria-label={`Play verse ${tile.label}`}>
                            <span class="scroll-label">{tile.label}</span>
                        </button>
                    {/if}
                {/each}
                <button class="scroll-tile end-tile" type="button" on:click={() => handlePlayVerse('end')}>
                    <span class="scroll-label">End of Chapter</span>
                </button>
            </section>
        {/if}
    </div>
</main>

{#if showModal}
<div class="verse-modal-overlay" on:click|self={closeModal} on:keydown={handleCloseKey} role="dialog" aria-modal="true">
    <section class="verse-modal-content" tabindex="0" on:click|stopPropagation>
        <button class="close-button" on:click={closeModal} aria-label="Close">✕</button>

        <!-- inline SVG speaker to avoid external 404 -->
        <div class="speaker-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Speaker">
                <path d="M5 9v6h4l5 4V5L9 9H5z" fill="#9f3629"/>
                <path d="M16.5 12a4.5 4.5 0 010 0" stroke="#9f3629" stroke-width="1.2" fill="none"/>
            </svg>
        </div>

        <div class="verse-text-display">
            <h3 style="color:#9f3629; font-weight:700;">Chapter {modalContent.chapter}, Verse {modalContent.verse}</h3>

            <div class="colored-text-block" style="text-align:left; margin:12px 0;">
                {@html modalContent.textHTML}
            </div>
        </div>

        <div class="audio-player" style="margin-top:12px;">
            <!-- bind:this ensures audioEl is available to script -->
            <audio controls bind:this={audioEl} style="width:100%;" aria-label={`Audio for verse ${modalContent.verse}`}>
                <!-- <source> kept as fallback; prepareAudioElement sets src programmatically -->
                <source src={modalContent.audioUrl} type="audio/mp3" />
                Your browser doesn't support the audio element.
            </audio>
        </div>

        <div style="margin-top:16px; display:flex; gap:12px; align-items:center; justify-content:center; flex-wrap:wrap;">
            {#if !recording}
                <button on:click={startRecording} type="button">Record Video</button>
            {:else}
                <button on:click={stopRecording} type="button">Stop Recording</button>
            {/if}

            {#if recordedVideoUrl}
                <button on:click={downloadRecordedVideo} type="button">Download Video</button>
                <button on:click={() => { const v = document.getElementById('previewVideo'); if (v) v.play(); }} type="button">Play Preview</button>
            {/if}
            <small style="display:block; width:100%; text-align:center; color:#333;">Tip: Use Chrome/Edge desktop for best recording support.</small>
        </div>

        <div style="margin-top:14px; display:flex; justify-content:center;">
            <canvas bind:this={canvasEl} width="1280" height="720" style="max-width:100%; border-radius:10px; box-shadow:0 6px 20px rgba(0,0,0,0.12);"></canvas>
        </div>

        {#if recordedVideoUrl}
            <div style="margin-top:12px;">
                <h4 style="margin:6px 0 8px 0; color:#333;">Recorded preview</h4>
                <video id="previewVideo" src={recordedVideoUrl} controls style="width:100%; border-radius:8px;">
                    <track kind="captions" srclang="en" label="English captions" default />
                </video>
            </div>
        {/if}
    </section>
</div>
{/if}

<style>
    /* keep your existing look but make some accessibility & layout tweaks */
    :global(body) {
        margin: 0;
        font-family: 'Playfair Display', Georgia, serif;
        background: radial-gradient(circle at center, #fffbe3 0%, #f7e6c4 80%, #fdfaf5 100%);
    }
    .chapter-content-area {
        max-width: 1400px;
        margin: 0 auto;
        padding: 40px 20px;
    }
    .back-link {
        font-size: 1.1em;
        color: #3b4d36;
        text-decoration: none;
        display: inline-block;
        margin-bottom: 20px;
    }
    .section-title-area, .verse-title-area {
        text-align: center;
        padding-top: 20px;
    }
    .chapter-title-red, .verse-heading-red {
        font-family: 'Cinzel', serif;
        color: #9f3629;
        font-weight: 700;
        letter-spacing: 5px;
    }

    .verse-tiles-grid {
        display: grid;
        grid-template-columns: repeat(9, 1fr);
        gap: 15px;
        padding: 40px 0;
        justify-items: center;
    }

    /* tiles are buttons for a11y */
    .scroll-tile {
        width: 110px;
        height: 180px;
        background-image: url('/scroll_tile_bg.png');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        border: none;
        box-shadow: 0 5px 10px rgba(0,0,0,0.18);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding-top: 10px;
        cursor: pointer;
        transition: transform 0.18s ease, box-shadow 0.18s ease;
        background-color: transparent;
    }
    .scroll-tile:hover, .scroll-tile:focus {
        transform: translateY(-6px);
        box-shadow: 0 12px 22px rgba(0,0,0,0.25);
        outline: none;
    }
    .scroll-label {
        font-family: 'Cinzel', serif;
        font-size: 1.2em;
        font-weight: 700;
        color: #7b5832;
    }
    .scroll-tile.special {
        width: 90px;
        height: 80px;
        background: #fff6ee;
        border-radius: 10px;
        box-shadow: 0 3px 8px rgba(0,0,0,0.12);
    }
    .end-tile {
        width: 140px;
        height: 80px;
    }

    /* modal */
    .verse-modal-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        padding: 20px;
    }
    .verse-modal-content {
        background-color: #ffe8d3;
        padding: 26px;
        border-radius: 14px;
        width: 100%;
        max-width: 980px;
        max-height: 92vh;
        overflow-y: auto;
        position: relative;
        border: 2px solid #9f3629;
    }
    .close-button {
        position: absolute;
        top: 12px;
        right: 12px;
        background: #9f3629;
        color: white;
        border: none;
        border-radius: 8px;
        width: 36px;
        height: 36px;
        cursor: pointer;
        font-size: 16px;
    }
    .speaker-icon { float: right; margin-left: 12px; }
    .verse-text-display { text-align: left; font-family: serif; }
    .colored-text-block { background: rgba(255,255,255,0.6); padding: 14px; border-radius: 8px; }
    .audio-player { margin-top: 14px; }

    button { font-family: inherit; }

    @media (max-width: 900px) {
        .verse-tiles-grid { grid-template-columns: repeat(4, 1fr); }
    }
    @media (max-width: 520px) {
        .verse-tiles-grid { grid-template-columns: repeat(2, 1fr); }
    }
</style>

