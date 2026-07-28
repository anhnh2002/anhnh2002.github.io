/* ===== Story version — immersive 3D background + scroll animations + tilt + lightbox ===== */
(function () {
    'use strict';

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    /* ---------- Three.js immersive scene ---------- */
    function initBackground() {
        var canvas = document.getElementById('bg-canvas');
        if (!canvas || typeof THREE === 'undefined') {
            document.documentElement.classList.add('no-webgl');
            return;
        }

        var renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                alpha: true,
                antialias: !isCoarsePointer,
                powerPreference: 'high-performance'
            });
        } catch (error) {
            document.documentElement.classList.add('no-webgl');
            return;
        }

        var compact = isCoarsePointer || window.innerWidth < 760;
        var quality = compact ? 0.52 : 1;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 1.75));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.setClearColor(0xe6ebf1, 0);

        var scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0xe6ebf1, 13, 40);

        var camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 80);
        camera.position.set(0, 0, 10);

        var world = new THREE.Group();
        scene.add(world);

        var ACCENTS = [
            new THREE.Color(0x3d6ec9), // hero
            new THREE.Color(0x2563eb), // research
            new THREE.Color(0x2e9e5f), // football
            new THREE.Color(0x0e9c90), // League
            new THREE.Color(0xa87e2f), // photography
            new THREE.Color(0x7456a8)  // epilogue
        ];
        var RGB_ACCENTS = ['61, 110, 201', '37, 99, 235', '46, 158, 95', '14, 156, 144', '168, 126, 47', '116, 86, 168'];
        var sceneEls = Array.prototype.slice.call(document.querySelectorAll('[data-scene]'));
        var sceneAnchors = [];

        /* ----- Shared textures and object helpers ----- */
        function makeGlowTexture() {
            var el = document.createElement('canvas');
            el.width = el.height = 128;
            var ctx = el.getContext('2d');
            var gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.16, 'rgba(255,255,255,.72)');
            gradient.addColorStop(0.5, 'rgba(255,255,255,.16)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 128, 128);
            return new THREE.CanvasTexture(el);
        }

        function makeTextTexture(text, color) {
            var el = document.createElement('canvas');
            el.width = 1024;
            el.height = 160;
            var ctx = el.getContext('2d');
            ctx.clearRect(0, 0, el.width, el.height);
            ctx.font = '700 64px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color || '#315fae';
            ctx.shadowColor = 'rgba(255,255,255,.9)';
            ctx.shadowBlur = 12;
            ctx.fillText(text, el.width / 2, el.height / 2);
            var texture = new THREE.CanvasTexture(el);
            texture.minFilter = THREE.LinearFilter;
            return texture;
        }

        function makeLabel(text, color, scale) {
            var material = new THREE.SpriteMaterial({
                map: makeTextTexture(text, color),
                transparent: true,
                opacity: 0.46,
                depthWrite: false
            });
            material.userData.baseOpacity = material.opacity;
            var sprite = new THREE.Sprite(material);
            sprite.scale.set(6.4 * (scale || 1), 1 * (scale || 1), 1);
            return sprite;
        }

        function makePointField(count, size, color, spread, opacity, glowTexture) {
            var geometry = new THREE.BufferGeometry();
            var positions = new Float32Array(count * 3);
            for (var i = 0; i < count; i++) {
                var side = i % 2 ? 1 : -1;
                positions[i * 3] = side * (2.4 + Math.random() * spread);
                positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.2;
                positions[i * 3 + 2] = -2 - Math.random() * spread * 1.5;
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            var material = new THREE.PointsMaterial({
                map: glowTexture,
                size: size,
                color: color,
                transparent: true,
                opacity: opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            var points = new THREE.Points(geometry, material);
            world.add(points);
            return points;
        }

        function rememberOpacity(root) {
            root.traverse(function (object) {
                if (!object.material) return;
                var materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(function (material) {
                    if (typeof material.opacity === 'number' && material.userData.baseOpacity === undefined) {
                        material.userData.baseOpacity = material.opacity;
                    }
                });
            });
        }

        function setGroupOpacity(root, value) {
            root.visible = value > 0.008;
            root.traverse(function (object) {
                if (!object.material) return;
                var materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(function (material) {
                    var base = material.userData.baseOpacity;
                    if (base !== undefined) material.opacity = base * value;
                });
            });
        }

        function makeNetwork(points, color, opacity) {
            var group = new THREE.Group();
            var positions = [];
            for (var i = 0; i < points.length - 1; i++) {
                positions.push(points[i][0], points[i][1], points[i][2]);
                positions.push(points[i + 1][0], points[i + 1][1], points[i + 1][2]);
            }
            var lineGeo = new THREE.BufferGeometry();
            lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: opacity,
                blending: THREE.NormalBlending,
                depthWrite: false
            })));
            var nodeGeo = new THREE.SphereGeometry(0.055, compact ? 5 : 8, compact ? 5 : 8);
            points.forEach(function (point, index) {
                if (index % 2 && compact) return;
                var node = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({
                    color: index % 3 === 0 ? 0xffffff : color,
                    transparent: true,
                    opacity: 0.7
                }));
                node.position.set(point[0], point[1], point[2]);
                group.add(node);
            });
            rememberOpacity(group);
            return group;
        }

        var glowTexture = makeGlowTexture();
        var nearDust = makePointField(Math.round(280 * quality), 0.17, 0xc99642, 8, 0.32, glowTexture);
        var farDust = makePointField(Math.round(620 * quality), 0.1, 0x6f85af, 14, 0.28, glowTexture);

        /* ----- Architectural perspective grid ----- */
        var grid = new THREE.Group();
        var gridMaterial = new THREE.LineBasicMaterial({
            color: 0x6b7fa8,
            transparent: true,
            opacity: compact ? 0.08 : 0.14,
            depthWrite: false
        });
        for (var gx = -10; gx <= 10; gx += 2) {
            var xGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(gx, -7, 2),
                new THREE.Vector3(gx * 0.3, 3, -28)
            ]);
            grid.add(new THREE.Line(xGeo, gridMaterial));
        }
        for (var gz = 0; gz < 18; gz++) {
            var z = 2 - gz * 1.7;
            var width = 10 - gz * 0.34;
            var zGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-width, -7 + gz * 0.53, z),
                new THREE.Vector3(width, -7 + gz * 0.53, z)
            ]);
            grid.add(new THREE.Line(zGeo, gridMaterial));
        }
        world.add(grid);

        /* ----- Dimensional code ribbons, preserving the existing code-rain idea ----- */
        var codeRibbons = new THREE.Group();
        var codeLabels = ['const mind = learn();', 'ANH :: AI × SE', 'CodeWiki', 'RustPrint', 'C → Rust', 'LLM.agent()', '01 { } </>', 'reason → act'];
        var ribbonCount = compact ? 8 : 16;
        for (var r = 0; r < ribbonCount; r++) {
            var label = makeLabel(codeLabels[r % codeLabels.length], r % 3 === 0 ? '#0e9c90' : '#315fae', 0.72 + Math.random() * 0.35);
            var flank = r % 2 ? 1 : -1;
            label.position.set(flank * (5.2 + Math.random() * 3.6), (Math.random() - 0.5) * 10, -2 - Math.random() * 18);
            label.rotation.z = (Math.random() - 0.5) * 0.12;
            label.userData.speed = 0.00008 + Math.random() * 0.00012;
            label.userData.phase = Math.random() * Math.PI * 2;
            codeRibbons.add(label);
        }
        world.add(codeRibbons);

        /* ----- Personal ANH neural fingerprint ----- */
        var heroGroup = new THREE.Group();
        var fingerprintPoints = [
            [-2.4, -1.3, -8], [-1.7, 1.5, -8], [-1.05, -0.1, -7.7],
            [-0.35, 1.45, -8.2], [0.25, -1.4, -7.8], [0.85, 1.2, -8],
            [1.45, -0.25, -7.7], [2.15, 1.45, -8.1], [2.65, -1.4, -8]
        ];
        heroGroup.add(makeNetwork(fingerprintPoints, 0x3d6ec9, 0.42));
        var anh = makeLabel('A N H  //  NEURAL SIGNATURE', '#315fae', 0.95);
        anh.position.set(0, -2.25, -7.8);
        heroGroup.add(anh);
        world.add(heroGroup);

        /* ----- Chapter-specific AI signatures ----- */
        var motifGroups = [heroGroup];

        var researchGroup = new THREE.Group();
        var researchPoints = [];
        for (var rp = 0; rp < 15; rp++) {
            researchPoints.push([
                (rp % 3 - 1) * 2.1 + (Math.random() - 0.5) * 0.35,
                (Math.floor(rp / 3) - 2) * 1.05,
                -7 - (rp % 3) * 0.6
            ]);
        }
        researchGroup.add(makeNetwork(researchPoints, 0x2563eb, 0.4));
        ['REPOSITORY', 'EMBEDDING', 'REASONING'].forEach(function (text, index) {
            var token = makeLabel(text, '#2563eb', 0.55);
            token.position.set(index % 2 ? 5.5 : -5.5, 2.2 - index * 2.2, -7 - index);
            researchGroup.add(token);
        });
        world.add(researchGroup);
        motifGroups.push(researchGroup);

        var footballGroup = new THREE.Group();
        var sevenPoints = [
            [-2.2, 1.8, -8], [0, 2, -7.8], [2.3, 1.8, -8],
            [1.3, 0.7, -7.8], [0.7, -0.5, -7.7], [0.2, -1.8, -7.8], [-0.2, -3, -8]
        ];
        footballGroup.add(makeNetwork(sevenPoints, 0x2e9e5f, 0.5));
        var discipline = makeLabel('DISCIPLINE  //  ITERATE  //  7', '#2e9e5f', 0.62);
        discipline.position.set(0, 3, -8);
        footballGroup.add(discipline);
        world.add(footballGroup);
        motifGroups.push(footballGroup);

        var lolGroup = new THREE.Group();
        var lanePoints = [
            [-4, -2.4, -8], [-1.8, -0.8, -8], [0, 0, -7.6], [1.8, 0.8, -8], [4, 2.4, -8],
            [-4, 2.4, -8], [-1.8, 0.8, -8], [0, 0, -7.6], [1.8, -0.8, -8], [4, -2.4, -8]
        ];
        lolGroup.add(makeNetwork(lanePoints, 0x0e9c90, 0.5));
        var nexus = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.75, 0),
            new THREE.MeshBasicMaterial({ color: 0x0e9c90, wireframe: true, transparent: true, opacity: 0.55 })
        );
        nexus.position.set(0, 0, -7.4);
        lolGroup.add(nexus);
        world.add(lolGroup);
        motifGroups.push(lolGroup);

        var photoGroup = new THREE.Group();
        for (var ringIndex = 0; ringIndex < (compact ? 4 : 7); ringIndex++) {
            var ring = new THREE.Mesh(
                new THREE.TorusGeometry(1.25 + ringIndex * 0.48, 0.018, 5, 80),
                new THREE.MeshBasicMaterial({
                    color: ringIndex % 2 ? 0xa87e2f : 0xe0b765,
                    transparent: true,
                    opacity: 0.24 - ringIndex * 0.014
                })
            );
            ring.position.set(ringIndex % 2 ? 4.6 : -4.6, (ringIndex - 3) * 0.32, -7 - ringIndex * 0.4);
            photoGroup.add(ring);
        }
        var lightLabel = makeLabel('CAPTURE(light, time)', '#a87e2f', 0.62);
        lightLabel.position.set(0, -3.2, -8);
        photoGroup.add(lightLabel);
        world.add(photoGroup);
        motifGroups.push(photoGroup);

        var epilogueGroup = heroGroup.clone(true);
        epilogueGroup.traverse(function (object) {
            if (object.material) {
                object.material = object.material.clone();
                object.material.userData = Object.assign({}, object.material.userData);
            }
        });
        epilogueGroup.scale.setScalar(1.25);
        epilogueGroup.rotation.z = Math.PI * 0.04;
        world.add(epilogueGroup);
        rememberOpacity(epilogueGroup);
        motifGroups.push(epilogueGroup);
        motifGroups.forEach(rememberOpacity);

        /* ----- Chapter portals ----- */
        var portals = new THREE.Group();
        for (var portalIndex = 0; portalIndex < 4; portalIndex++) {
            var portal = new THREE.Mesh(
                new THREE.TorusGeometry(4.8 + portalIndex * 0.22, 0.025, 5, compact ? 72 : 120),
                new THREE.MeshBasicMaterial({
                    color: 0x3d6ec9,
                    transparent: true,
                    opacity: 0.2 - portalIndex * 0.026,
                    blending: THREE.NormalBlending,
                    depthWrite: false
                })
            );
            portal.position.z = -7.5 - portalIndex * 0.8;
            portal.rotation.z = portalIndex * 0.38;
            portals.add(portal);
        }
        rememberOpacity(portals);
        world.add(portals);

        /* ----- Scroll state, parallax and adaptive lifecycle ----- */
        var mouseX = 0, mouseY = 0;
        var targetX = 0, targetY = 0;
        var currentScene = 0;
        var targetScene = 0;
        var activeAccentIndex = -1;
        var frameId = null;
        var running = true;
        var resizeTimer = null;

        function updateAnchors() {
            sceneAnchors = sceneEls.map(function (el) {
                var rect = el.getBoundingClientRect();
                return rect.top + window.scrollY + Math.min(rect.height * 0.42, window.innerHeight * 0.55);
            });
        }

        function findScenePosition() {
            var cursor = window.scrollY + window.innerHeight * 0.5;
            if (cursor <= sceneAnchors[0]) return 0;
            for (var i = 0; i < sceneAnchors.length - 1; i++) {
                if (cursor <= sceneAnchors[i + 1]) {
                    var span = Math.max(1, sceneAnchors[i + 1] - sceneAnchors[i]);
                    var t = (cursor - sceneAnchors[i]) / span;
                    t = t * t * (3 - 2 * t);
                    return i + t;
                }
            }
            return sceneAnchors.length - 1;
        }

        function updateAccent(index) {
            if (index === activeAccentIndex) return;
            activeAccentIndex = index;
            document.documentElement.style.setProperty('--scene-glow', RGB_ACCENTS[index]);
        }

        if (!compact) {
            window.addEventListener('pointermove', function (event) {
                targetX = (event.clientX / window.innerWidth - 0.5) * 2;
                targetY = (event.clientY / window.innerHeight - 0.5) * 2;
            }, { passive: true });
        }

        window.addEventListener('scroll', function () {
            targetScene = findScenePosition();
        }, { passive: true });

        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, (isCoarsePointer || window.innerWidth < 760) ? 1.25 : 1.75));
                renderer.setSize(window.innerWidth, window.innerHeight);
                updateAnchors();
                targetScene = findScenePosition();
            }, 120);
        });

        function render(time) {
            if (!running) return;
            frameId = window.requestAnimationFrame(render);

            if (!prefersReducedMotion) {
                currentScene += (targetScene - currentScene) * 0.035;
                mouseX += (targetX - mouseX) * 0.045;
                mouseY += (targetY - mouseY) * 0.045;
            } else {
                currentScene = targetScene;
            }

            var low = Math.floor(currentScene);
            var high = Math.min(motifGroups.length - 1, low + 1);
            var mix = currentScene - low;
            var accent = ACCENTS[low].clone().lerp(ACCENTS[high], mix);
            gridMaterial.color.copy(accent);
            portals.children.forEach(function (portal, index) {
                portal.material.color.copy(accent);
                if (!prefersReducedMotion) portal.rotation.z += (index % 2 ? -1 : 1) * 0.00018;
            });

            for (var i = 0; i < motifGroups.length; i++) {
                setGroupOpacity(motifGroups[i], Math.max(0, 1 - Math.abs(currentScene - i)));
            }
            setGroupOpacity(portals, 0.45 + Math.sin(mix * Math.PI) * 0.55);

            camera.position.x = mouseX * (compact ? 0.15 : 0.68);
            camera.position.y = -mouseY * (compact ? 0.08 : 0.38);
            camera.position.z = 10 - Math.sin(mix * Math.PI) * 0.7;
            camera.rotation.x = mouseY * -0.025;
            camera.rotation.z = mouseX * 0.012;
            world.position.x = -mouseX * 0.18;

            if (!prefersReducedMotion) {
                codeRibbons.children.forEach(function (label) {
                    label.position.y += label.userData.speed * 16;
                    if (label.position.y > 6) label.position.y = -6;
                    label.material.opacity = label.material.userData.baseOpacity *
                        (0.62 + Math.sin(time * 0.001 + label.userData.phase) * 0.22);
                });
                nearDust.rotation.y = time * 0.000035 + mouseX * 0.08;
                farDust.rotation.y = -time * 0.000018;
                researchGroup.rotation.y = Math.sin(time * 0.00022) * 0.09;
                nexus.rotation.y = time * 0.00028;
                nexus.rotation.x = time * 0.00017;
                photoGroup.rotation.z = Math.sin(time * 0.00013) * 0.035;
            }

            updateAccent(Math.round(currentScene));
            renderer.render(scene, camera);
        }

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                running = false;
                if (frameId !== null) window.cancelAnimationFrame(frameId);
            } else if (prefersReducedMotion) {
                running = true;
                render(performance.now());
                running = false;
                if (frameId !== null) window.cancelAnimationFrame(frameId);
            } else if (!running) {
                running = true;
                render(performance.now());
            }
        });

        updateAnchors();
        targetScene = findScenePosition();
        currentScene = targetScene;
        updateAccent(Math.round(currentScene));
        if (prefersReducedMotion) {
            render(0);
            running = false;
            if (frameId !== null) window.cancelAnimationFrame(frameId);
        } else {
            render(0);
        }
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
        gsap.utils.toArray('.reveal:not(.card)').forEach(function (el) {
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
