/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const searchForm = document.getElementById("searchForm");
const productsContainer = document.getElementById("productsContainer");
const generateRoutine = document.getElementById("generateRoutine");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const selectedProductIds = new Set(); // Keep track of selected product IDs
let allProducts = []; // Store all products loaded from the JSON file
const storageKey = "selectedProducts"; // Key for localStorage to persist selected products

const workerUrl = "https://test-worker.gumarm1.workers.dev"; // URL of the Cloudflare Worker for OpenAI API requests

let messageHistory = [
  {
    role: 'system',
    content: `You are an expert assistant for L'Oréal. Your job is to answer user questions about L'Oréal products, services, and company information with accuracy and helpfulness. When responding to recommendations (e.g., “What L'Oréal products are best for me?”), provide comprehensive and descriptive answers: explain not only which products fit the user's needs, but also why those products are suitable, including the reasoning behind your recommendations based on user context (such as skin type, hair type, concerns, or goals).

    If a user provides personal preferences, needs, or relevant context, use this information in your explanations. Always reason step-by-step in your response before giving the final recommendation or answer: begin with a brief explanation of factors considered, then present your conclusion and recommendations last.

    For company, product, or service information requests, respond factually, concisely, and in a helpful tone.

    **Output Format:**
    - Respond in a clear, conversational paragraph. Do not use lists unless clarity demands it.
    - Structure recommendation responses as follows:  
      Reasoning/Explanation (break down thought process, reference relevant user-provided information, preferrably as bullet points) → Final Answer/Recommendation (give specific product/service and rationale).
    - For factual questions, brief accurate paragraph response.

    ### Example 1 — Product Recommendation

    **User Input:**  
    What L'Oréal shampoo should I use for color-treated hair?

    **Expected Output:**  
    When choosing a shampoo for color-treated hair, it's important to look for products formulated to protect and extend the vibrancy of your hair color, as well as keep it healthy and hydrated. L'Oréal's EverPure Sulfate-Free Color Care Shampoo is recommended because it is specifically designed for color-treated hair; it gently cleanses without stripping color and helps maintain softness and shine.

    ### Example 2 — Factual Information

    **User Input:**  
    Is L'Oréal cruelty-free?

    **Expected Output:**  
    L'Oréal is not certified as a cruelty-free company. While L'Oréal does not test its products or ingredients on animals in most countries, exceptions are made where regulatory authorities require it for safety or regulatory compliance.

    (**Note:** Real responses should include all relevant user context and product details where necessary.)

    ---

    **Reminder:**  
    Always reason through the relevant factors and user context before giving your final recommendation or answer. Recommendations should first explain the reasoning behind your choice, then provide a clear conclusion. Factual questions require concise, precise answers.
    
    If the user asks anything other than L'Oréal products, services, or company information, politely inform them that you can only provide information related to L'Oréal and its offerings.`
  }
]; // Store the conversation history for the chat feature

function saveSelectedProducts() {
  localStorage.setItem(storageKey, JSON.stringify(Array.from(selectedProductIds))); // Save selected product IDs to localStorage as a JSON string
}

// Update the state of the "Generate Routine" button based on whether any products are selected
function updateGenerateRoutineButtonState() {
  generateRoutine.disabled = selectedProductIds.size === 0;
  generateRoutine.classList.toggle("disabled", selectedProductIds.size === 0); // Add or remove the "disabled" class for styling based on selection state
}

// Sync the selection state of product cards in the main product list with the selected products list
function syncProductCardSelection(productId, isSelected) {
  const productCard = productsContainer.querySelector(`[data-product-id="${productId}"]`); // Find the product card in the main product list that corresponds to the given product ID
  if (productCard) {
    productCard.classList.toggle("selected", isSelected); // Add or remove the "selected" class based on whether the product is selected, providing visual feedback to the user
  }
}

// Load selected products from localStorage when the page loads
function loadSelectedProducts() {
  const savedProducts = localStorage.getItem(storageKey); // Retrieve the saved product IDs from localStorage
  if (savedProducts) {
    const productIds = JSON.parse(savedProducts); // Parse the JSON string back into an array of product IDs
    productIds.forEach((id) => selectedProductIds.add(String(id))); // Add each product ID to the selectedProductIds set to restore the selection state
  }
}

loadSelectedProducts(); // Load selected products from localStorage when the page loads

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

selectedProductsList.innerHTML = `<p class="placeholder-message">No products selected yet</p>`; // Show initial placeholder until user selects products

// Load the product data once on startup so saved selections can be rendered right away.
loadProducts().then(() => {
  renderSelectedProducts();
});

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products; // Store the loaded products in the allProducts variable for later use
  return allProducts; // Return the loaded products for immediate use in filtering and displaying
}

// Render the selected products in the selected products list
function renderSelectedProducts() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(String(product.id))
  );

  // If no products are selected, display a placeholder message in the selected products list
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p class="placeholder-message">No products selected yet</p>`;
    updateGenerateRoutineButtonState(); // Calls the function to update the state of the "Generate Routine" button based on whether any products are selected
    return;
  }

  // Create HTML for each selected product and update the selected products list
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="product-card selected-product-card" data-product-id="${product.id}">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
          </div>
          <button class="remove-product-button" data-product-id="${product.id}">Remove</button>
        </div>
      `
    )
    .join("");

  updateGenerateRoutineButtonState(); // Calls the function to update the state of the "Generate Routine" button based on whether any products are selected
}

// Handle search form submission. Filters products based on the search query and selected category.
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // Prevent the default form submission behavior to avoid page reload

  if(!document.getElementById("searchInput").value.trim()) {
    alert("Please enter a search query before searching.");
    return;
  }

  if(!categoryFilter.value) {
    alert("Please select a category before searching.");
    return;
  }
  
  const searchQuery = document.getElementById("searchInput").value.toLowerCase(); // Get the search query and convert it to lowercase for case-insensitive matching
  const selectedCategory = categoryFilter.value; // Get the selected category from the dropdown
  const products = await loadProducts(); // Load the products from the JSON file
  searchForm.querySelector("button").disabled = true; // Disable the search button to prevent multiple submissions while processing

  // Filter products based on the search query and selected category. The filter() method creates a new array containing only products that match the search query and category.
  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery) || product.brand.toLowerCase().includes(searchQuery); // Check if the product name or brand includes the search query
    const matchesCategory = selectedCategory === "" || product.category === selectedCategory; // Check if the product category matches the selected category or if no category is selected (empty string)
    return matchesSearch && matchesCategory;
  });

  displayProducts(filteredProducts); // Call the displayProducts function to update the UI with the filtered products
  searchForm.reset(); // Reset the search form to clear the input field after submission
  searchForm.querySelector("button").disabled = false; // Re-enable the search button after processing is complete
});

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card${selectedProductIds.has(String(product.id)) ? " selected" : ""}" data-product-id="${product.id}"> 
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `
    )
    .join("");
}

/* Click handler for product cards */
productsContainer.addEventListener("click", (e) => {
  const productCard = e.target.closest(".product-card");
  if (!productCard) {
    return;
  }

  const productId = productCard.dataset.productId; // Get the product ID from the data attribute

  // Toggle selection state of the product and ensure the product remains selected if it was already selected
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId); // Remove product ID from the set if already selected. This allows the user to deselect a product by clicking on it again.
  } else {
    selectedProductIds.add(productId); // Add product ID to the set if not already selected. This allows the user to select a product by clicking on it.
  }

  productCard.classList.toggle("selected"); // Toggle the "selected" class for visual feedback
  syncProductCardSelection(productId, selectedProductIds.has(productId)); // Update the product card selection state to reflect the current selection status
  renderSelectedProducts();
  saveSelectedProducts(); // Save the selected products to localStorage
});

/* Click handler for removing selected products */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-product-button");
  if (!removeButton) {
    return;
  }
  const productId = removeButton.dataset.productId; // Get the product ID from the data attribute of the remove button
  selectedProductIds.delete(String(productId)); // Remove the product ID from the selectedProductIds set
  syncProductCardSelection(productId, false); // Update the product card selection state to reflect that the product is no longer selected
  renderSelectedProducts();
  saveSelectedProducts(); // Save the updated selected products to localStorage
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
  renderSelectedProducts();
});

// Event listener for when the user generates a routine.
generateRoutine.addEventListener("click", async (e) => {
  e.preventDefault();
  console.log("Routine requested for products:", Array.from(selectedProductIds)); // Log the selected product IDs for debugging purposes

  // Scrolls the entire page to the bottom so the user can see the chat window
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth',
  });

  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.has(String(product.id)) 
  );
  const routinePrompt = `Please generate a skincare routine using these selected products. Keep the routine simple and concise, and provide clear instructions for each step.\n${selectedProducts
    .map((product) => `${product.name} (${product.brand})`) // Create a string representation of each selected product with its name and brand
    .join(", ")}`; // Build the prompt from the products selected right now
  
  messageHistory.push({ role: 'user', content: routinePrompt }); // Add the user's request to the conversation history for context in the AI response

  // Add a new paragraph element for the user's message
  const userMessage = document.createElement("div"); // Create a new paragraph element for the user's message
  userMessage.className = "user-message";
  userMessage.innerHTML = `
  <h3>You</h3> <p>Please generate a skincare routine using the selected products.</p>
  `;
  chatWindow.appendChild(userMessage);

  // Display a "Thinking..." message in the chat window while the routine is being generated
  const assistantMessage = document.createElement("div");
  assistantMessage.className = "assistant-message";
  assistantMessage.textContent = "Thinking..."; // Show processing message
  chatWindow.appendChild(assistantMessage); // Append the assistant's message to the chat window
  chatWindow.scrollTop = chatWindow.scrollHeight; // Scroll to the bottom of the chat window

  console.log("Generating routine for selected products...");

  try {
    // Make the API call to the Cloudflare Worker to generate the routine
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant from L'Oréal that generates skincare routines based on selected products. Always keep routines simple and concise, and provide clear instructions for each step."
          },
          {
            role: "user",
            content: routinePrompt
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 500
      })
    });

    // Check if the response is OK (status code 200-299)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json(); // Parse the JSON response from the worker
    const routineText = result.choices[0].message.content; // Extract the generated routine text from the response
    console.log("Routine Generated. ", routineText); // Log the generated routine for debugging purposes

    // Add the assistant's reply to the messages array AKA the conversation history
    messageHistory.push({ role: 'assistant', content: routineText });

    // Update the assistant's message in the chat window
    assistantMessage.innerHTML = `
    <h3>Assistant</h3> <p>${routineText}</p>
    `; 

    
  } catch (error) {
    console.error("Error generating routine:", error);
    document.getElementById("chatWindow").innerHTML = "An error occurred while generating the routine. Please try again.";
  }
});

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userInput = document.getElementById("userInput").value.trim(); // Get user input and trim whitespace

  // Scrolls the entire page to the bottom so the user can see the chat window
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: 'smooth',
  });

  // Add a new paragraph element for the user's message
  const userMessage = document.createElement("div"); // Create a new paragraph element for the user's message
  userMessage.className = "user-message";
  userMessage.innerHTML = `
  <h3>You</h3> <p>${userInput}</p>
  `;
  chatWindow.appendChild(userMessage);

  messageHistory.push({ role: "user", content: userInput });
  console.log('Prompt submitted. Generating response for user input:', userInput);

  // Clear the user input field after submission
  document.getElementById("userInput").value = '';

  // Display a "Thinking..." message in the chat window while the routine is being generated
  const assistantMessage = document.createElement("div");
  assistantMessage.className = "assistant-message";
  assistantMessage.textContent = "Thinking..."; // Show processing message
  chatWindow.appendChild(assistantMessage); // Append the assistant's message to the chat window
  chatWindow.scrollTop = chatWindow.scrollHeight; // Scroll to the bottom of the chat window
  
  // Try block to handle potential errors during the API request
  try {
    // Make a POST request to the OpenAI API endpoint for chat completions
    const response = await fetch(workerUrl, {
      method: 'POST', // This is POST-ing data to the API
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messageHistory, // Send the conversation history to the API
      }),
    });

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`); // Throw an error if the response is not OK
    }

    // Parse JSON response from the Cloudflare Worker
    const result = await response.json();

    // Get the reply from OpenAI's response structure
    const replyText = result.choices[0].message.content;
    console.log("Reply received:", replyText); // Log the assistant's reply for debugging

    // Add the assistant's reply to the messages array AKA the conversation history
    messageHistory.push({ role: 'assistant', content: replyText });

    // Update the assistant's message in the chat window
    assistantMessage.innerHTML = `
    <h3>Assistant</h3> <p>${replyText}</p>
    `; 
    chatWindow.scrollTop = chatWindow.scrollHeight; // Scroll to the bottom of the chat window to show the latest message

  } catch (error) {
    console.error('Error:', error); // Log any errors to the console
    assistantMessage.textContent = "Sorry! An error occurred while processing your request. Please try again later."; // Show error message to the user
    return; // Exit the function if an error occurs
  }

});

