/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";

// --- Type Definition ---
interface Recipe {
    recipeName: string;
    description: string;
    ingredients: string[];
    instructions: string[];
    imageUrl?: string;
}

// --- DOM Element References ---
const recipeForm = document.getElementById('recipe-form') as HTMLFormElement;
const promptInput = document.getElementById('prompt-input') as HTMLInputElement;
const difficultySelect = document.getElementById('difficulty-select') as HTMLSelectElement;
const wishesInput = document.getElementById('wishes-input') as HTMLTextAreaElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const loadingIndicator = document.getElementById('loading-indicator') as HTMLDivElement;
const recipeOutput = document.getElementById('recipe-output') as HTMLDivElement;
const viewSavedBtn = document.getElementById('view-saved-btn') as HTMLButtonElement;
const savedCountBadge = document.getElementById('saved-count-badge') as HTMLSpanElement;
const themeToggle = document.getElementById('theme-toggle') as HTMLInputElement;

// Browse Recipes Modal
const browseRecipesBtn = document.getElementById('browse-recipes-btn') as HTMLButtonElement;
const browseRecipesModal = document.getElementById('browse-recipes-modal') as HTMLDivElement;
const closeBrowseModalBtn = document.getElementById('close-browse-modal-btn') as HTMLButtonElement;
const browseRecipesList = document.getElementById('browse-recipes-list') as HTMLDivElement;

// Saved Recipes Modal
const savedRecipesModal = document.getElementById('saved-recipes-modal') as HTMLDivElement;
const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;
const savedRecipesList = document.getElementById('saved-recipes-list') as HTMLDivElement;

// Add Recipe Modal
const addRecipeBtn = document.getElementById('add-recipe-btn') as HTMLButtonElement;
const addRecipeModal = document.getElementById('add-recipe-modal') as HTMLDivElement;
const closeAddModalBtn = document.getElementById('close-add-modal-btn') as HTMLButtonElement;
const addRecipeForm = document.getElementById('add-recipe-form') as HTMLFormElement;
const addRecipeNameInput = document.getElementById('add-recipe-name') as HTMLInputElement;
const addRecipeDescriptionTextarea = document.getElementById('add-recipe-description') as HTMLTextAreaElement;
const addRecipeIngredientsTextarea = document.getElementById('add-recipe-ingredients') as HTMLTextAreaElement;
const addRecipeInstructionsTextarea = document.getElementById('add-recipe-instructions') as HTMLTextAreaElement;
const addRecipeImageInput = document.getElementById('add-recipe-image') as HTMLInputElement;


// --- State ---
let currentRecipe: Recipe | null = null;

// --- Sample Data ---
const sampleRecipeIdeas = [
    "Schnelle Tomaten-Mozzarella-Nudeln",
    "Hähnchen-Curry mit Reis",
    "Vegetarische Linsen-Bolognese",
    "Einfacher Grießbrei mit Früchten",
    "Kartoffel-Lauch-Suppe",
    "Wraps mit Hähnchen und Gemüse",
    "Pfannkuchen mit Apfelmus",
    "Thunfischsalat-Sandwich",
    "One-Pot-Pasta mit Spinat und Feta",
    "Gebratener Reis mit Ei und Gemüse"
];

// --- Gemini AI Setup ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const recipeSchema = {
  type: Type.OBJECT,
  properties: {
    recipeName: {
      type: Type.STRING,
      description: "Der Name des Rezepts."
    },
    description: {
        type: Type.STRING,
        description: "Eine kurze, ansprechende Beschreibung des Gerichts."
    },
    ingredients: {
      type: Type.ARRAY,
      description: "Eine Liste der Zutaten, die für das Rezept benötigt werden.",
      items: { type: Type.STRING }
    },
    instructions: {
      type: Type.ARRAY,
      description: "Eine schrittweise Anleitung zur Zubereitung des Gerichts.",
      items: { type: Type.STRING }
    },
  },
  required: ["recipeName", "description", "ingredients", "instructions"],
};

// --- Helper Functions ---
function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}


// --- LocalStorage Functions ---
function getSavedRecipes(): Recipe[] {
    const recipesJSON = localStorage.getItem('savedRecipes');
    return recipesJSON ? JSON.parse(recipesJSON) : [];
}

function saveRecipeToStorage(recipe: Recipe) {
    const recipes = getSavedRecipes();
    if (!recipes.some(r => r.recipeName.toLowerCase() === recipe.recipeName.toLowerCase())) {
        recipes.push(recipe);
        localStorage.setItem('savedRecipes', JSON.stringify(recipes));
        updateSavedCount();
    } else {
        // Optional: Handle case where recipe name already exists
        alert("Ein Rezept mit diesem Namen existiert bereits.");
    }
}

function updateRecipeInStorage(originalRecipeName: string, updatedRecipe: Recipe) {
    let recipes = getSavedRecipes();
    const recipeIndex = recipes.findIndex(r => r.recipeName.toLowerCase() === originalRecipeName.toLowerCase());
    if (recipeIndex > -1) {
        recipes[recipeIndex] = updatedRecipe;
        localStorage.setItem('savedRecipes', JSON.stringify(recipes));
        updateSavedCount();
        renderSavedRecipes();
    }
}


function removeRecipeFromStorage(recipeName: string) {
    let recipes = getSavedRecipes();
    recipes = recipes.filter(r => r.recipeName !== recipeName);
    localStorage.setItem('savedRecipes', JSON.stringify(recipes));
    updateSavedCount();
    renderSavedRecipes();
}

function isRecipeSaved(recipeName: string): boolean {
    const recipes = getSavedRecipes();
    return recipes.some(r => r.recipeName.toLowerCase() === recipeName.toLowerCase());
}


// --- UI Update Functions ---
function setLoading(isLoading: boolean) {
    generateButton.disabled = isLoading;
    const saveEditBtn = document.getElementById('save-edit-btn') as HTMLButtonElement | null;
    if (saveEditBtn) {
        saveEditBtn.disabled = isLoading;
    }
    loadingIndicator.classList.toggle('hidden', !isLoading);
    if (isLoading) {
        recipeOutput.style.opacity = '0.5';
    } else {
        recipeOutput.style.opacity = '1';
    }
}

function renderRecipe(recipe: Recipe | null) {
    if (!recipe) {
        recipeOutput.innerHTML = '';
        return;
    }

    const originalRecipeForUpdate = { ...recipe };
    currentRecipe = recipe;
    const isSaved = isRecipeSaved(recipe.recipeName);

    recipeOutput.innerHTML = `
        <div class="recipe-card">
            ${recipe.imageUrl ? `<img src="${recipe.imageUrl}" alt="${recipe.recipeName}" class="recipe-image">` : ''}
             <div id="recipe-display">
                <h2>${recipe.recipeName}</h2>
                <p class="description">${recipe.description}</p>
                <div class="recipe-details">
                    <div class="ingredients">
                        <h3>Zutaten</h3>
                        <ul>
                            ${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="instructions">
                        <h3>Anleitung</h3>
                        <ol>
                            ${recipe.instructions.map(i => `<li>${i}</li>`).join('')}
                        </ol>
                    </div>
                </div>
            </div>

            <div id="recipe-edit-form" class="hidden">
                 <div class="form-group">
                    <label for="edit-recipe-name">Rezeptname</label>
                    <input type="text" id="edit-recipe-name" value="${recipe.recipeName.replace(/"/g, '&quot;')}">
                </div>
                 <div class="form-group">
                    <label for="edit-recipe-description">Beschreibung</label>
                    <textarea id="edit-recipe-description" rows="3">${recipe.description}</textarea>
                </div>
                 <div class="form-group">
                    <label for="edit-recipe-ingredients">Zutaten (eine pro Zeile)</label>
                    <textarea id="edit-recipe-ingredients" rows="5">${recipe.ingredients.join('\n')}</textarea>
                </div>
                 <div class="form-group">
                    <label for="edit-recipe-instructions">Anleitung (ein Schritt pro Zeile)</label>
                    <textarea id="edit-recipe-instructions" rows="7">${recipe.instructions.join('\n')}</textarea>
                </div>
                 <div class="form-group">
                    <label for="edit-recipe-image">Foto ändern (optional)</label>
                    <input type="file" id="edit-recipe-image" accept="image/*">
                </div>
            </div>

            <div class="recipe-card-actions">
                <button id="save-recipe-btn" ${isSaved ? 'disabled' : ''}>
                    ${isSaved ? 'Gespeichert' : 'Rezept speichern'}
                </button>
                <button id="edit-recipe-btn">Rezept bearbeiten</button>
                <button id="share-recipe-btn" class="secondary-btn">Rezept teilen</button>
                <button id="save-edit-btn" class="hidden">Änderungen speichern</button>
                <button id="cancel-edit-btn" class="hidden secondary-btn">Abbrechen</button>
            </div>
        </div>
    `;
    
    // Element References
    const saveRecipeBtn = document.getElementById('save-recipe-btn') as HTMLButtonElement;
    const editRecipeBtn = document.getElementById('edit-recipe-btn') as HTMLButtonElement;
    const saveEditBtn = document.getElementById('save-edit-btn') as HTMLButtonElement;
    const cancelEditBtn = document.getElementById('cancel-edit-btn') as HTMLButtonElement;
    const shareRecipeBtn = document.getElementById('share-recipe-btn') as HTMLButtonElement;
    const recipeDisplay = document.getElementById('recipe-display') as HTMLDivElement;
    const recipeEditForm = document.getElementById('recipe-edit-form') as HTMLDivElement;

    // Event Listeners
    saveRecipeBtn?.addEventListener('click', () => {
        if (currentRecipe) {
            saveRecipeToStorage(currentRecipe);
            saveRecipeBtn.disabled = true;
            saveRecipeBtn.textContent = 'Gespeichert';
        }
    });

    editRecipeBtn?.addEventListener('click', () => {
        recipeDisplay.classList.add('hidden');
        recipeEditForm.classList.remove('hidden');
        editRecipeBtn.classList.add('hidden');
        saveRecipeBtn.classList.add('hidden');
        shareRecipeBtn.classList.add('hidden');
        saveEditBtn.classList.remove('hidden');
        cancelEditBtn.classList.remove('hidden');
    });

    cancelEditBtn?.addEventListener('click', () => {
        renderRecipe(originalRecipeForUpdate);
    });

    shareRecipeBtn?.addEventListener('click', () => {
        if (currentRecipe) {
            navigator.clipboard.writeText(JSON.stringify(currentRecipe, null, 2))
                .then(() => {
                    const originalText = shareRecipeBtn.textContent;
                    shareRecipeBtn.textContent = 'Kopiert!';
                    shareRecipeBtn.disabled = true;
                    setTimeout(() => {
                        shareRecipeBtn.textContent = originalText;
                        shareRecipeBtn.disabled = false;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Fehler beim Kopieren des Rezepts: ', err);
                    alert('Das Rezept konnte nicht kopiert werden.');
                });
        }
    });

    saveEditBtn?.addEventListener('click', async () => {
        const imageInput = document.getElementById('edit-recipe-image') as HTMLInputElement;
        const imageFile = imageInput.files?.[0];
        let imageUrl = originalRecipeForUpdate.imageUrl; // Keep old image by default

        if (imageFile) {
            try {
                imageUrl = await readFileAsDataURL(imageFile);
            } catch (error) {
                console.error("Fehler beim Lesen der Bilddatei:", error);
                alert("Das Bild konnte nicht verarbeitet werden.");
                return; // Stop if image processing fails
            }
        }

        const updatedRecipe: Recipe = {
            recipeName: (document.getElementById('edit-recipe-name') as HTMLInputElement).value.trim(),
            description: (document.getElementById('edit-recipe-description') as HTMLTextAreaElement).value.trim(),
            ingredients: (document.getElementById('edit-recipe-ingredients') as HTMLTextAreaElement).value.split('\n').map(i => i.trim()).filter(i => i !== ''),
            instructions: (document.getElementById('edit-recipe-instructions') as HTMLTextAreaElement).value.split('\n').map(i => i.trim()).filter(i => i !== ''),
            imageUrl: imageUrl,
        };
        
        // If the name changed, we need to check if the new name already exists
        if (updatedRecipe.recipeName.toLowerCase() !== originalRecipeForUpdate.recipeName.toLowerCase() && isRecipeSaved(updatedRecipe.recipeName)) {
             alert("Ein Rezept mit diesem neuen Namen existiert bereits.");
             return;
        }

        updateRecipeInStorage(originalRecipeForUpdate.recipeName, updatedRecipe);
        renderRecipe(updatedRecipe);
    });
}

function renderError(message: string) {
    recipeOutput.innerHTML = `<div class="error-message">${message}</div>`;
}

function updateSavedCount() {
    const count = getSavedRecipes().length;
    if (count > 0) {
        savedCountBadge.textContent = String(count);
        savedCountBadge.classList.remove('hidden');
    } else {
        savedCountBadge.classList.add('hidden');
    }
}

function renderSavedRecipes() {
    const recipes = getSavedRecipes();
    savedRecipesList.innerHTML = '';
    if (recipes.length === 0) {
        savedRecipesList.innerHTML = '<p class="no-saved-recipes">Du hast noch keine Rezepte gespeichert.</p>';
        return;
    }

    recipes.forEach(recipe => {
        const item = document.createElement('div');
        item.classList.add('saved-recipe-item');
        item.innerHTML = `
            ${recipe.imageUrl ? `<img src="${recipe.imageUrl}" alt="${recipe.recipeName}" class="saved-recipe-thumbnail">` : '<div class="saved-recipe-thumbnail-placeholder">🍳</div>'}
            <div class="saved-recipe-details">
                <h4>${recipe.recipeName}</h4>
                <p>${recipe.description}</p>
            </div>
            <div>
                <button class="view-btn">Ansehen</button>
                <button class="delete-btn">Löschen</button>
            </div>
        `;

        item.querySelector('.view-btn')?.addEventListener('click', () => {
            renderRecipe(recipe);
            savedRecipesModal.classList.add('hidden');
        });
        item.querySelector('.delete-btn')?.addEventListener('click', () => {
            if (confirm(`Möchtest du das Rezept "${recipe.recipeName}" wirklich löschen?`)) {
                removeRecipeFromStorage(recipe.recipeName);
            }
        });
        savedRecipesList.appendChild(item);
    });
}

function renderBrowseRecipes() {
    browseRecipesList.innerHTML = '';
    sampleRecipeIdeas.forEach(idea => {
        const item = document.createElement('button');
        item.classList.add('recipe-idea-btn');
        item.textContent = idea;
        item.addEventListener('click', () => {
            promptInput.value = idea;
            browseRecipesModal.classList.add('hidden');
            recipeForm.dispatchEvent(new Event('submit', { cancelable: true }));
        });
        browseRecipesList.appendChild(item);
    });
}


// --- Main Gemini Function ---
async function generateRecipe(event: Event) {
    event.preventDefault();
    if (!promptInput.value.trim()) {
        alert("Bitte gib ein, was du kochen möchtest.");
        return;
    }
    setLoading(true);
    renderError('');
    renderRecipe(null);

    const prompt = `
        Erstelle ein einfaches und günstiges Rezept für Lehrlinge basierend auf den folgenden Angaben.
        Gib die Antwort als einzelnes JSON-Objekt zurück, das dem bereitgestellten Schema entspricht. Gib keinen Markdown oder zusätzlichen Text aus.

        Gericht: "${promptInput.value}"
        Schwierigkeitsgrad: "${difficultySelect.value}"
        Zusätzliche Wünsche: "${wishesInput.value || 'Keine'}"
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: recipeSchema,
            },
        });
        const responseText = result.text.trim();
        const recipe: Recipe = JSON.parse(responseText);
        renderRecipe(recipe);
    } catch (error) {
        console.error("Fehler bei der Rezeptgenerierung:", error);
        renderError("Entschuldigung, bei der Erstellung des Rezepts ist ein Fehler aufgetreten. Bitte versuche es später erneut oder präzisiere deine Anfrage.");
    } finally {
        setLoading(false);
    }
}

// --- Add Manual Recipe ---
async function handleAddRecipe(event: Event) {
    event.preventDefault();

    const imageFile = addRecipeImageInput.files?.[0];
    let imageUrl: string | undefined = undefined;

    if (imageFile) {
        try {
            imageUrl = await readFileAsDataURL(imageFile);
        } catch (error) {
            console.error("Fehler beim Lesen der Bilddatei:", error);
            alert("Das Bild konnte nicht verarbeitet werden.");
            return;
        }
    }

    const newRecipe: Recipe = {
        recipeName: addRecipeNameInput.value.trim(),
        description: addRecipeDescriptionTextarea.value.trim(),
        ingredients: addRecipeIngredientsTextarea.value.split('\n').map(line => line.trim()).filter(line => line),
        instructions: addRecipeInstructionsTextarea.value.split('\n').map(line => line.trim()).filter(line => line),
        imageUrl: imageUrl,
    };

    if (!newRecipe.recipeName || newRecipe.ingredients.length === 0 || newRecipe.instructions.length === 0) {
        alert("Bitte fülle alle erforderlichen Felder aus.");
        return;
    }

    saveRecipeToStorage(newRecipe);
    addRecipeForm.reset();
    addRecipeModal.classList.add('hidden');
    renderSavedRecipes();
}

// --- Theme Toggle ---
function toggleTheme(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
    }
}


// --- Event Listeners ---
function initializeApp() {
    recipeForm.addEventListener('submit', generateRecipe);

    // Modal Toggles
    viewSavedBtn.addEventListener('click', () => {
        renderSavedRecipes();
        savedRecipesModal.classList.remove('hidden');
    });
    closeModalBtn.addEventListener('click', () => savedRecipesModal.classList.add('hidden'));

    browseRecipesBtn.addEventListener('click', () => {
        renderBrowseRecipes();
        browseRecipesModal.classList.remove('hidden');
    });
    closeBrowseModalBtn.addEventListener('click', () => browseRecipesModal.classList.add('hidden'));

    addRecipeBtn.addEventListener('click', () => addRecipeModal.classList.remove('hidden'));
    closeAddModalBtn.addEventListener('click', () => addRecipeModal.classList.add('hidden'));

    // Close modals on overlay click
    [savedRecipesModal, browseRecipesModal, addRecipeModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    addRecipeForm.addEventListener('submit', handleAddRecipe);

    // Theme
    themeToggle.addEventListener('change', toggleTheme);
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.checked = true;
    }

    // Initial State
    updateSavedCount();
}

// --- App Initialization ---
initializeApp();