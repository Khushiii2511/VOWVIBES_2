<script>
    import GitaChapterTile from "./GitaChapterTile.svelte";
    const chapters = Array.from({ length: 18 }, (_, i) => i + 1);
</script>

<div class="wrapper">
    <h2 class="title">GITA CHAPTERS</h2>

    <div class="grid">
        {#each chapters as c}
            <div class="cell">
                <GitaChapterTile chapterId={c} />
            </div>
        {/each}
    </div>
</div>

<style>
    .wrapper {
        text-align: center;
        padding-top: 40px;
    }

    /* Section Title */
    .title {
        font-family: Arial, sans-serif;
        font-size: 1.2em;
        border-bottom: 2px solid #9f3629;
        padding-bottom: 4px;
        width: 260px;
        margin: 0 auto 60px;
        letter-spacing: 3px;
    }

    /* ⭐ 5 books per row + spacing */
    .grid {
        display: grid;
        grid-template-columns: repeat(5, 160px); /* 5 tiles in one line */
        justify-content: center;
        column-gap: 80px; /* space between tiles */
        row-gap: 55px;
        position: relative;
    }

    /* ⭐ Row 2 → shift for staggered effect (elements 6 to 10) */
    .cell:nth-child(n+6):nth-child(-n+10) {
        transform: translateX(80px);
    }
</style>
