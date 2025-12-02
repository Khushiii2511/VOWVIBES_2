<script>
    import { goto } from '$app/navigation';
    export let chapterId;

    function navigateTo() {
        goto(`/chapter/${chapterId}`);
    }
</script>

<button class="tile" on:click={navigateTo}>
    <div class="diamond">
        <div class="image"></div>
        <div class="num">{chapterId}</div>
    </div>
</button>

<style>
    .tile {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        width: 160px;
        height: 160px;
        transition: transform .25s ease;
    }

    .tile:hover {
        transform: translateY(-6px);
    }

    /* Diamond box */
    .diamond {
        width: 160px;
        height: 160px;
        background: #fdfaf5;
        border: 1px solid #d7d1c4;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
        overflow: hidden;
        position: relative;
        transform: rotate(45deg);
    }

    /* Background image with brightness + opacity and soft blur */
    .image {
        position: absolute;
        inset: 0;
        background-image: url('/chapter_art_placeholder.jpg');
        background-size: cover;
        background-position: center;
        opacity: 0.55;
        filter: brightness(1.15);
    }

    /* Big centered chapter number */
    .num {
        position: absolute;
        inset: 0;
        display: flex;
        justify-content: center;
        align-items: center;

        font-size: 2.8rem;
        font-family: 'Cinzel', serif;
        font-weight: 700;
        color: #8c1b18;

        transform: rotate(-45deg);
        z-index: 10;
    }
</style>
