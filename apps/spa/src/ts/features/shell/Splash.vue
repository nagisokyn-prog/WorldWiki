<template>
      <div class="splash-wrapper">
    <div class="splash-container">
  <div class="splash-container">
    <!-- ASCII Art -->
    <div id="asciiArt" ref="asciiArtRef" class="ascii-art"></div>
    
    <div class="subtitle">Загрузка мира...</div>
    
    <div class="progress-container">
      <div id="progressBar" ref="progressBarRef" class="progress-bar"></div>
    </div>
    <div id="statusText" ref="statusTextRef" class="status-text">Инициализация...</div>
    
    <div id="perfBadge" ref="perfBadgeRef" class="perf-badge">⚡ Производительность: ---</div>
    <div id="perfDetails" ref="perfDetailsRef" class="perf-details"></div>
  </div>
  </div>
 </div>
</template>

<script src="./Splash.vue.ts" lang="ts"></script>


<style src="./Splash.vue.css"></style>

