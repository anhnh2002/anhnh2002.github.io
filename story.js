/* ===== Story version — immersive 3D background + scroll animations + tilt + lightbox ===== */
(function () {
    'use strict';

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    /* ---------- Three.js immersive scene ---------- */
    function initBackground() {
        if (typeof THREE === 'undefined') return;

        var canvas = document.getElementById('bg-canvas');
        var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);

        var scene = new THREE.Scene();
        // Fog melts distant objects into the page background.
        scene.fog = new THREE.Fog(0xf3f0ea, 9, 26);

        var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0, 10);

        // Soft daylight rig.
        scene.add(new THREE.AmbientLight(0xffffff, 0.85));
        var key = new THREE.DirectionalLight(0xfff2dd, 0.9);
        key.position.set(4, 6, 8);
        scene.add(key);
        var rim = new THREE.DirectionalLight(0xc9d8f5, 0.5);
        rim.position.set(-6, -3, 4);
        scene.add(rim);

        /* ----- Floating pastel solids ----- */
        var palette = [0xd9b36a, 0x9fb6e0, 0x8fd0c8, 0xd9a8a0, 0xb9a8d9];
        var geometries = [
            new THREE.IcosahedronGeometry(1, 0),
            new THREE.TorusKnotGeometry(0.7, 0.22, 90, 14),
            new THREE.OctahedronGeometry(1, 0),
            new THREE.TorusGeometry(0.8, 0.26, 18, 44),
            new THREE.DodecahedronGeometry(0.9, 0)
        ];

        var shapes = [];
        var SHAPE_COUNT = 11;
        for (var i = 0; i < SHAPE_COUNT; i++) {
            var geo = geometries[i % geometries.length];
            var color = palette[i % palette.length];
            var solid = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.35,
                metalness: 0.15,
                transparent: true,
                opacity: 0.9
            });
            var mesh = new THREE.Mesh(geo, solid);

            // Distribute in a wide band around the camera path.
            var side = i % 2 === 0 ? 1 : -1;
            mesh.position.set(
                side * (2.5 + Math.random() * 5.5),
                (Math.random() - 0.5) * 22,
                -4 - Math.random() * 12
            );
            var s = 0.5 + Math.random() * 0.9;
            mesh.scale.setScalar(s);
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

            // Wireframe twin for a light architectural feel.
            var wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
                color: 0x22202e,
                wireframe: true,
                transparent: true,
                opacity: 0.08
            }));
            wire.scale.setScalar(1.02);
            mesh.add(wire);

            mesh.userData = {
                spinX: (Math.random() - 0.5) * 0.003,
                spinY: (Math.random() - 0.5) * 0.004,
                bobAmp: 0.3 + Math.random() * 0.5,
                bobSpeed: 0.0004 + Math.random() * 0.0006,
                bobPhase: Math.random() * Math.PI * 2,
                baseY: mesh.position.y
            };
            scene.add(mesh);
            shapes.push(mesh);
        }

        /* ----- Layered dust fields (darker tones read on a light page) ----- */
        function makeField(count, size, color, spread, opacity) {
            var geometry = new THREE.BufferGeometry();
            var positions = new Float32Array(count * 3);
            for (var i = 0; i < count * 3; i++) {
                positions[i] = (Math.random() - 0.5) * spread;
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            var material = new THREE.PointsMaterial({
                size: size,
                color: color,
                transparent: true,
                opacity: opacity,
                depthWrite: false
            });
            var points = new THREE.Points(geometry, material);
            scene.add(points);
            return points;
        }

        var near = makeField(450, 0.06, 0xa87e2f, 18, 0.5);   // gold dust, close
        var far = makeField(800, 0.035, 0x6a7a9e, 30, 0.35); // slate motes, deep

        /* ----- Pointer + scroll driven camera ----- */
        var mouseX = 0, mouseY = 0;
        var targetX = 0, targetY = 0;

        window.addEventListener('pointermove', function (e) {
            targetX = (e.clientX / window.innerWidth - 0.5) * 2;
            targetY = (e.clientY / window.innerHeight - 0.5) * 2;
        }, { passive: true });

        window.addEventListener('resize', function () {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        function scrollProgress() {
            var max = document.documentElement.scrollHeight - window.innerHeight;
            return max > 0 ? window.scrollY / max : 0;
        }

        function animate(time) {
            requestAnimationFrame(animate);

            mouseX += (targetX - mouseX) * 0.045;
            mouseY += (targetY - mouseY) * 0.045;

            var p = scrollProgress();

            if (!prefersReducedMotion) {
                // Camera dives gently through the scene as the story unfolds.
                camera.position.y = -p * 6;
                camera.position.x = mouseX * 0.7;
                camera.rotation.x = -mouseY * 0.05 + p * 0.12;
                camera.rotation.z = mouseX * 0.02;

                for (var i = 0; i < shapes.length; i++) {
                    var m = shapes[i];
                    var u = m.userData;
                    m.rotation.x += u.spinX;
                    m.rotation.y += u.spinY;
                    m.position.y = u.baseY + Math.sin(time * u.bobSpeed + u.bobPhase) * u.bobAmp;
                }

                near.rotation.y = time * 0.00004 + mouseX * 0.1;
                far.rotation.y = -time * 0.00002 + mouseX * 0.04;
            }

            renderer.render(scene, camera);
        }

        animate(0);
    }

    /* ---------- GSAP scroll animations ---------- */
    function initAnimations() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        gsap.registerPlugin(ScrollTrigger);

        if (prefersReducedMotion) return; // leave everything statically visible

        // Hero title lines rise in with a 3D flip on load.
        gsap.from('.hero-title .line span', {
            yPercent: 110,
            rotateX: -50,
            transformOrigin: '50% 100%',
            duration: 1.2,
            ease: 'power4.out',
            stagger: 0.12,
            delay: 0.2
        });
        gsap.from('.hero-kicker, .hero-sub, .scroll-hint', {
            opacity: 0,
            y: 24,
            duration: 1,
            ease: 'power2.out',
            stagger: 0.15,
            delay: 0.7
        });

        // Hero content drifts back in depth as you scroll away.
        gsap.to('.hero-inner', {
            z: -180,
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
                trigger: '.hero',
                start: 'top top',
                end: 'bottom 30%',
                scrub: true
            }
        });

        // Generic reveal for anything tagged .reveal.
        gsap.utils.toArray('.reveal').forEach(function (el) {
            gsap.from(el, {
                opacity: 0,
                y: 40,
                duration: 0.9,
                ease: 'power2.out',
                scrollTrigger: { trigger: el, start: 'top 85%' }
            });
        });

        // Chapter headers slide in; ghost numeral parallaxes at its own depth.
        gsap.utils.toArray('.chapter-head').forEach(function (head) {
            var tl = gsap.timeline({
                scrollTrigger: { trigger: head, start: 'top 80%' }
            });
            tl.from(head.querySelector('.chapter-num'), { opacity: 0, x: -30, duration: 0.7, ease: 'power2.out' })
              .from(head.querySelector('.chapter-title'), { opacity: 0, y: 50, rotateX: -25, transformOrigin: '50% 100%', duration: 0.9, ease: 'power3.out' }, '-=0.4')
              .from(head.querySelector('.chapter-tag'), { opacity: 0, y: 20, duration: 0.7, ease: 'power2.out' }, '-=0.5');
        });

        // Research cards fan in with a 3D turn.
        gsap.utils.toArray('.cards').forEach(function (grid) {
            gsap.from(grid.querySelectorAll('.card'), {
                opacity: 0,
                y: 60,
                rotateY: -18,
                transformOrigin: '50% 50%',
                duration: 0.9,
                ease: 'power3.out',
                stagger: 0.12,
                scrollTrigger: { trigger: grid, start: 'top 85%' }
            });
        });

        // The giant CR7 "7" parallaxes behind the text.
        var cr7 = document.querySelector('.cr7-number');
        if (cr7) {
            gsap.fromTo(cr7, { yPercent: 20, rotate: -4 }, {
                yPercent: -20,
                rotate: 4,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.chapter-football',
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true
                }
            });
        }

        // LoL stat tiles pop.
        gsap.utils.toArray('.lol-stat').forEach(function (stat, i) {
            gsap.from(stat, {
                opacity: 0,
                scale: 0.6,
                rotateX: -30,
                duration: 0.7,
                ease: 'back.out(2)',
                delay: i * 0.12,
                scrollTrigger: { trigger: '.lol-stats', start: 'top 85%' }
            });
        });

        // Photos drift up with a stagger inside each gallery.
        gsap.utils.toArray('.gallery').forEach(function (gallery) {
            gsap.from(gallery.querySelectorAll('.photo'), {
                opacity: 0,
                y: 60,
                rotateX: 8,
                duration: 0.9,
                ease: 'power2.out',
                stagger: 0.12,
                scrollTrigger: { trigger: gallery, start: 'top 85%' }
            });
        });

        // Lazy-loaded images shift the layout as they arrive, which would leave
        // ScrollTrigger positions stale (and some reveals never firing).
        var refreshTimer = null;
        function scheduleRefresh() {
            if (refreshTimer) clearTimeout(refreshTimer);
            refreshTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 200);
        }
        document.querySelectorAll('.photo img').forEach(function (img) {
            if (img.complete) return;
            img.addEventListener('load', scheduleRefresh);
            img.addEventListener('error', scheduleRefresh);
        });
    }

    /* ---------- Pointer-driven 3D tilt ---------- */
    function initTilt() {
        if (prefersReducedMotion || isCoarsePointer || typeof gsap === 'undefined') return;

        document.querySelectorAll('.card, .photo').forEach(function (el) {
            var rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3.out' });
            var ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3.out' });
            var lift = gsap.quickTo(el, 'z', { duration: 0.5, ease: 'power3.out' });
            var strength = el.classList.contains('photo') ? 5 : 8;

            el.addEventListener('pointermove', function (e) {
                var rect = el.getBoundingClientRect();
                var px = (e.clientX - rect.left) / rect.width - 0.5;
                var py = (e.clientY - rect.top) / rect.height - 0.5;
                ry(px * strength);
                rx(-py * strength);
                lift(14);
            });
            el.addEventListener('pointerleave', function () {
                rx(0);
                ry(0);
                lift(0);
            });
        });
    }

    /* ---------- Scroll progress bar ---------- */
    function initProgress() {
        var bar = document.getElementById('scroll-progress');
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(function () {
                var max = document.documentElement.scrollHeight - window.innerHeight;
                bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
                ticking = false;
            });
        }, { passive: true });
    }

    /* ---------- Lightbox ---------- */
    function initLightbox() {
        var lightbox = document.getElementById('lightbox');
        var img = document.getElementById('lightbox-img');
        var caption = document.getElementById('lightbox-caption');
        var closeBtn = document.getElementById('lightbox-close');

        document.querySelectorAll('.photo').forEach(function (figure) {
            figure.addEventListener('click', function () {
                var source = figure.querySelector('img');
                img.src = source.src;
                img.alt = source.alt;
                caption.textContent = figure.querySelector('figcaption').textContent;
                lightbox.classList.add('open');
                lightbox.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';
            });
        });

        function close() {
            lightbox.classList.remove('open');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        closeBtn.addEventListener('click', close);
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) close();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initBackground();
        initAnimations();
        initTilt();
        initProgress();
        initLightbox();
    });
})();
