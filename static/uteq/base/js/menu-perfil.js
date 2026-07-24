document.addEventListener('DOMContentLoaded', function() {

    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const profileOverlay = document.getElementById('profileOverlay');

    if (!profileBtn || !profileDropdown || !profileOverlay) {
        return;
    }

    function openDropdown() {
        profileDropdown.classList.add('show');
        profileOverlay.classList.add('show');
        profileBtn.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDropdown() {
        profileDropdown.classList.remove('show');
        profileOverlay.classList.remove('show');
        profileBtn.classList.remove('active');
        document.body.style.overflow = '';
    }

    function toggleDropdown(e) {
        e.preventDefault();
        e.stopPropagation();

        if (profileDropdown.classList.contains('show')) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    // Event listeners
    profileBtn.addEventListener('click', toggleDropdown);
    profileOverlay.addEventListener('click', closeDropdown);

    profileDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && profileDropdown.classList.contains('show')) {
            closeDropdown();
        }
    });
});