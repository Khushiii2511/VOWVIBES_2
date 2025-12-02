<script>
    import { onMount } from 'svelte';

    let dynamicStyle = '';
    onMount(() => {
        // NOTE: The path for the image is relative to the static folder, so it stays '/krishna_chariot.jpg'
        dynamicStyle = 'background-image: url("/krishna_chariot.jpg");'; 
    });
</script>

<svelte:head>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="page-container">
    
    <header>
        <div class="top-nav">
            <div class="logo-placeholder">
                <img src="/logo.png" alt="Site Logo" class="site-logo">
            </div> 
            
            <nav>
                <a href="#">AYURVEDA</a>
                <a href="#">YOGASUTRAS</a>
                <span class="nav-gita-title">BHAGAVAD GITA</span>
                <a href="/">UPANISADS</a>
                <a href="#">SANSKRIT</a>
                <a href="#">CONTACT US</a>
            </nav>
        </div>
        
        <div class="gita-title-area">
            <h1 class="gita-title">BHAGAVAD GITA</h1>
        </div>
        
        <div class="banner" style="{dynamicStyle}">
            <div class="open-book-icon"></div> 
        </div>
    </header>

    <slot /> 

    <footer>
        <div class="connect-section">
            <p>Connect</p>
            <div class="social-icons">
                <a href="#"><span class="icon">f</span></a>
                <a href="#"><span class="icon">t</span></a>
                <a href="#"><span class="icon">y</span></a>
                <a href="#"><span class="icon">⏰</span></a>
            </div>
        </div>
        <div class="footer-logo"></div> 
        <p class="footer-tagline">WELLBEING~SVASTI</p>
        <p class="copyright">© 2025 Rutger Kortenhorst. All Rights Reserved | Design and Developed by <a href="#">Burning Desire Inclusive</a></p>
    </footer>
    
    <a href="#top" class="scroll-top">^</a>
</div>

<style>
    /* --------------------------------------
       GLOBAL STYLES (FROM +page.svelte & layout)
       -------------------------------------- */
    :global(body) {
        margin: 0;
        /* Using link in head is preferred over @import in style block */
        font-family: 'Playfair Display', Georgia, serif; 
        background-color: #fdfaf5; 
    }
    .page-container {
        min-height: 100vh;
        color: #333;
    }
    header {
        text-align: center;
        margin-bottom: 40px;
    }
    
    /* Top Navigation */
    .top-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 5%;
        background-color: #fcf8f0; 
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .site-logo {
        height: 40px; 
    }
    nav a, .nav-gita-title {
        margin-left: 15px;
        text-decoration: none;
        color: #777; 
        font-size: 0.85em;
        font-family: Arial, sans-serif; 
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .nav-gita-title {
        font-weight: 700;
        color: #333;
    }
    
    /* Title Area */
    .gita-title-area {
        position: relative;
        background: rgba(255, 255, 255, 0.3); 
        padding: 10px 0;
    }
    .gita-title {
        font-family: 'Cinzel', serif; 
        font-size: 5em;
        font-weight: 700; 
        letter-spacing: 12px;
        color: #3b4d36; 
        margin: 0;
        text-shadow: none; 
    }
    
    /* Banner Image Section */
    .banner {
        height: 400px;
        background-size: cover;
        background-position: center 20%;
        display: block;
        position: relative;
    }
    .open-book-icon {
        width: 150px; 
        height: 120px;
        background-image: url('/open_book.png'); 
        background-size: contain;
        background-repeat: no-repeat;
        position: absolute;
        bottom: -60px; 
        left: 50%;
        transform: translateX(-50%);
        z-index: 10;
    }

    /* Footer Styles */
    footer {
        background-color: #3b4d36; 
        color: #e0e0e0;
        padding: 40px 0 20px 0;
        text-align: center;
        margin-top: 50px;
    }
    .connect-section {
        font-size: 1em;
        margin-bottom: 10px;
    }
    .connect-section p {
        font-size: 1.2em;
        font-weight: 700; 
    }
    .social-icons .icon {
        background-color: transparent; 
        border: 1px solid #e0e0e0;
        border-radius: 50%;
        color: #e0e0e0;
        line-height: 28px;
    }
    .footer-logo {
        height: 50px; 
        margin-bottom: 5px;
        background-image: url('/svasti_logo_footer.png'); 
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
    }
    .footer-tagline {
        font-family: 'Cinzel', serif;
        font-size: 2.2em; 
        font-weight: 700; 
        margin-top: 5px;
        margin-bottom: 20px;
        color: #fff;
        letter-spacing: 2px;
    }
    .copyright {
        font-size: 0.85em; 
        font-family: Arial, sans-serif;
        padding-top: 15px; 
        border-top: 1px solid rgba(255, 255, 255, 0.1); 
    }
    .copyright a {
        color: #9cb598;
    }

    /* Scroll Top Button */
    .scroll-top {
        right: 10px;
        background-color: #555;
    }
</style>