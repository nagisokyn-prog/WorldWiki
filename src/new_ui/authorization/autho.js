import { createApp } from 'vue'
import Autho from '../../js/components/Vue/Autho.vue'
import DateWheels from '../../js/components/Vue/DateWheels.vue'
import XboxWheel from '../../js/components/Vue/XboxWheel.vue'
import RelationshipBlock from '../../js/components/Vue/RelationshipBlock.vue'

// Intercept fetch to fix relative paths
const originalFetch = window.fetch
window.fetch = function(resource, config) {
  let url = resource
  if (typeof resource === 'string') {
    // Convert relative path to absolute
    if (resource === '../new_ui/authorization/config.json') {
      url = '/src/new_ui/authorization/config.json'
    }
  }
  return originalFetch(url, config)
}

const app = createApp(Autho)

// Register components globally
app.component('DateWheels', DateWheels)
app.component('XboxWheel', XboxWheel)
app.component('RelationshipBlock', RelationshipBlock)

app.mount('#autho-app')
