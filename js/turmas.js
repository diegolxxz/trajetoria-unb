(() => {
    const modo = document.getElementById('modoAvancadoTurmas');
    function atualizarModo() {
        document.getElementById('listaDisciplinas').classList.toggle('modo-avancado', modo.checked);
        document.getElementById('detalhesModo').hidden = !modo.checked;
    }
    modo.addEventListener('change', atualizarModo);
    atualizarModo();
})();
