export class SelectorEditor {
    constructor(selector) {
      this.selector = selector;
    }
  
    displayEditor() {
      const editorContainer = document.createElement('div');
      editorContainer.className = 'selector-editor-container';
      
      const inputField = document.createElement('input');
      inputField.type = 'text';
      inputField.value = this.selector;
      editorContainer.appendChild(inputField);
      
      const saveButton = document.createElement('button');
      saveButton.textContent = 'Save';
      saveButton.addEventListener('click', () => this.saveSelector(inputField.value));
      editorContainer.appendChild(saveButton);
  
      document.body.appendChild(editorContainer);
    }
  
    saveSelector(updatedSelector) {
      this.selector = updatedSelector;
      console.log('Updated Selector:', updatedSelector);
    }
  }
  