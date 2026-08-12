/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const searchForm = document.getElementById("searchForm");
const productsContainer = document.getElementById("productsContainer");
const generateRoutine = document.getElementById("generateRoutine");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductIds = new Set(); // Keep track of selected product IDs
let allProducts = []; // Store all products loaded from the JSON file
const storageKey = "selectedProducts"; // Key for localStorage to persist selected products

const workerUrl = "https://test-worker.gumarm1.workers.dev"; // URL of the Cloudflare Worker for OpenAI API requests

let messageHistory = []; // Store the conversation history for the chat feature

function saveSelectedProducts() {
  localStorage.setItem(storageKey, JSON.stringify(Array.from(selectedProductIds))); // Save selected product IDs to localStorage as a JSON string
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
        </div>
      `
    )
    .join("");
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
  renderSelectedProducts();
  saveSelectedProducts(); // Save the selected products to localStorage
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

const routinePrompt = `Please generate a skincare routine using the following products. Keep the routine simple and concise, and provide clear instructions for each step.
${Array.from(selectedProductIds).join(", ")}`; // Create a prompt for the AI model using the selected product IDs

// Event listener for when the user generates a routine.
generateRoutine.addEventListener("click", async (e) => {
  e.preventDefault();
  console.log("Generating routine for selected products:", Array.from(selectedProductIds));
  
  const button = document.querySelector("#generateRoutine");
  if (selectedProductIds.size > 0) {
    button.disabled = false; // Enable the button if there are selected products
  } else {
    button.disabled = true; // Disable the button if there are no selected products
  }

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
            content: "You are a helpful assistant from L'Oréal that generates skincare routines based on selected products. Always keep routines simple and concise, and provide clear instructions for each step."},
            {
              role: "user",
              content: routinePrompt
            }
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
    console.log("Generated Routine:", routineText); // Log the generated routine for debugging purposes

    // Add the new message to the message history
    messageHistory.push({
      role: "user",
      content: Array.from(selectedProductIds)
    });
    messageHistory.push({
      role: "assistant",
      content: result
    });

  } catch (error) {
    console.error("Error generating routine:", error);
    document.getElementById("chatWindow").innerHTML = "An error occurred while generating the routine. Please try again.";
  }
});

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const userInput = document.getElementById("userInput").value;

  messageHistory.push({
    role: "user",
    content: userInput
  });

  chatWindow.innerHTML = "Connect to the OpenAI API for a response!";
});

