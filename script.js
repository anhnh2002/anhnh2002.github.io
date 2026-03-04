document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                tabs.forEach(t => {
                    const href = t.getAttribute('href');
                    if (href === '#' + id) {
                        tabs.forEach(tab => tab.classList.remove('active'));
                        t.classList.add('active');
                    }
                });
            }
        });
    }, { threshold: 0.3 });

    document.querySelectorAll('section[id]').forEach(section => {
        observer.observe(section);
    });
});
