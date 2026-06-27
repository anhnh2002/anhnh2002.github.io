document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab');
    const nav = document.querySelector('.tab-nav');

    // Map each section id to the tab that should be highlighted when it's in view.
    // The profile ("main") and news sections both belong to the "Main" tab.
    const sectionToTab = {
        main: '#main',
        news: '#main',
        publications: '#publications',
        projects: '#projects',
        contact: '#contact'
    };

    const sections = Object.keys(sectionToTab)
        .map(id => document.getElementById(id))
        .filter(Boolean);

    function setActive(href) {
        tabs.forEach(t => t.classList.toggle('active', t.getAttribute('href') === href));
    }

    function updateActiveTab() {
        // The section crossing a reference line below the sticky nav is "current".
        // Using the topmost such section avoids highlighting the next section early.
        // The line sits ~30% down the viewport (but always clear of the nav) so a
        // section just scrolled under the nav by an anchor jump counts as current.
        const navBottom = nav.getBoundingClientRect().bottom;
        const line = Math.max(navBottom + 1, window.innerHeight * 0.3);
        let current = sections[0];
        for (const section of sections) {
            if (section.getBoundingClientRect().top <= line) {
                current = section;
            }
        }
        // Trailing sections can be too short to ever reach the top of a tall
        // viewport, so once scrolled to the bottom, activate the last tab.
        if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
            current = sections[sections.length - 1];
        }
        if (current) setActive(sectionToTab[current.id]);
    }

    tabs.forEach(tab => {
        // The CV tab is an external link (opens in a new tab); leave the
        // in-page tab highlighting untouched when it's clicked.
        if (tab.classList.contains('tab-cv')) return;
        tab.addEventListener('click', function() {
            setActive(this.getAttribute('href'));
        });
    });

    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                updateActiveTab();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    updateActiveTab();
});
