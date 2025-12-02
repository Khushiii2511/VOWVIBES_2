<script>
    // Removed onMount and dynamicStyle since the Banner is now handled by the layout.
    import GitaChapterTile from '$lib/GitaChapterTile.svelte'; 

    const chapters = Array.from({ length: 18 }, (_, i) => i + 1);
</script>

<main class="chapter-list-section">
    <h2 class="section-title">GITA CHAPTERS</h2>
    <div class="chapter-tiles-grid">
        {#each chapters as chapterId}
            <GitaChapterTile chapterId={chapterId} />
        {/each}
    </div>
</main>

<style>
    /* --------------------------------------
       Chapter List Section Styles
       -------------------------------------- */
    .chapter-list-section {
        max-width: 1200px;
        margin: 100px auto 50px auto; 
        padding: 0 20px;
        text-align: center;
    }
    .section-title {
        font-size: 1.2em;
        text-align: center;
        letter-spacing: 3px;
        border-bottom: 2px solid #9f3629; 
        display: inline-block;
        padding-bottom: 5px;
        margin-bottom: 50px;
        width: 250px;
        font-family: Arial, sans-serif; 
    }
    .chapter-tiles-grid {
        display: grid;
        grid-template-columns: repeat(6, 170px); 
        justify-content: center;
        gap: 20px 60px; 
    }
    /* Removed all global, header, and footer styles */
</style>