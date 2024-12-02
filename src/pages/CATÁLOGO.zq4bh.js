// Referencia de la API de Velo: https://www.wix.com/velo/reference/api-overview/introduction
import wixData from 'wix-data';
import wixLocation from 'wix-location';

let currentPage = 0
const itemsPerPage = 18
let hasMoreItems = true
const staticImageServerUrl = "https://assets.avax.pe/static/"


$w.onReady(function () {
    initializeDropdowns()
    configureWhatsappIntegration()
    setProductsImages()

    $w('#prevPageTop').onClick(() => loadPrevPage())
    $w('#prevPageBottom').onClick(() => {
        loadPrevPage()
        focusOnFilters()
    })
    $w('#nextPageTop').onClick(() => loadNextPage())
    $w('#nextPageBottom').onClick(() => {
        loadNextPage()
        focusOnFilters()
    })

    applyFilters($w('#dropdownSizes'), $w('#dropdownBrand'), $w('#dropdownPrice'), $w('#productDataset'))
})

function setProductsImages() {
    $w('#repeater1').onItemReady(($item, itemData) => {
        const code = itemData.codigo;
        const fmtCode = code.replace(/ /g, "%20");
        const imageUrl = `${staticImageServerUrl}${fmtCode}_img_principal.JPEG`;
        let imageElement = $item("#image2")
        imageElement.src = imageUrl
    })
}

function initializeDropdowns() {
    const productCollectionName = 'productos'
    const brandCollectionName = 'marca'
    const dropdownSizes = $w('#dropdownSizes')
    const dropdownBrand = $w('#dropdownBrand')
    const dropdownPrice = $w('#dropdownPrice')
    const productDataset = $w('#productDataset')


    getUniqueSizes(productCollectionName)
        .then((uniqueSizes) => configureSizeDropdown(dropdownSizes, uniqueSizes))
        .catch((error) => console.error("Error getting sizes:", error))

    getUniqueBrands(brandCollectionName)
        .then((uniqueBrands) => configureBrandDropdown(dropdownBrand, uniqueBrands))
        .catch((error) => console.error("Error getting brands:", error))

    getPriceRanges(productCollectionName)
        .then((priceRanges) => configurePriceDropdown(dropdownPrice, priceRanges))
        .catch((error) => console.error("Error getting price ranges:", error))

    dropdownSizes.onChange(() => applyFilters(dropdownSizes, dropdownBrand, dropdownPrice, productDataset))
    dropdownBrand.onChange(() => applyFilters(dropdownSizes, dropdownBrand, dropdownPrice, productDataset))
    dropdownPrice.onChange(() => applyFilters(dropdownSizes, dropdownBrand, dropdownPrice, productDataset))

}

function getUniqueSizes(collectionName) {
    return wixData.query(collectionName).find().then((results) => {
        const allSizes = results.items.reduce((sizes, item) => {
            if (item.tallas) {
                item.tallas.split(" - ").forEach((size) => {
                    size.split(" - ").forEach((individualSize) => {
                        const formattedSize = individualSize.trim()
                        if (!sizes.includes(formattedSize)) {
                            sizes.push(formattedSize)
                        }
                    })
                })
            }
            return sizes
        }, [])
        return allSizes.sort((a, b) => parseFloat(a) - parseFloat(b))
    })
}

function getUniqueBrands(collectionName) {
    return wixData.query(collectionName).find().then((results) => {
        const allBrands = results.items.reduce((brands, item) => {
            if (item.marca && !brands.includes(item.marca) && item.prioridad !== undefined) {
                brands.push({ nombre: item.marca, prioridad: item.prioridad })
            }
            return brands
        }, [])
        allBrands.sort((a, b) => a.prioridad - b.prioridad)
        return [...new Set(allBrands.map(brand => brand.nombre))]
        // return allBrands.sort((a, b) => parseFloat(a) - parseFloat(b))      // TODO: Revisar si se quiere en orden alfabético o como está en CMS
    })
}


function getPriceRanges(collectionName) {
    return wixData.query(collectionName).find().then((results) => {
        const priceRanges = results.items.reduce((ranges, item) => {
            const {price, range, order} = generatePriceRanges(item.price)
            if (price && !ranges.includes(range)) {
                ranges.push({ range: range, order: order })
            }
            return ranges
        }, [])
        priceRanges.sort((a, b) => a.order - b.order)
        return [...new Set(priceRanges.map(range => range.range))]
    })
}

function configureSizeDropdown(dropdown, uniqueSizes) {
    const options = [{ label: "TODAS", value: "" }]
    options.push(...uniqueSizes.map((size) => ({ label: size, value: size })))
    dropdown.options = options
}

function configureBrandDropdown(dropdown, uniqueBrands) {
    const options = [{ label: "TODAS", value: "" }]
    options.push(...uniqueBrands.map((brand) => ({ label: brand, value: brand})))
    dropdown.options = options
}

function configurePriceDropdown(dropdown, priceRanges) {
    const options = [{ label: "FILTRAR PRECIO", value: "" }]
    options.push(...priceRanges.map((priceRange) => ({ label: priceRange, value: priceRange})))
    dropdown.options = options
}

function applyFilters(dropdownSizes, dropdownBrands, dropdownPriceRanges, productDataset) {
    const selectedSize = dropdownSizes.value
    const selectedBrand = dropdownBrands.value
    const selectedPriceRange = dropdownPriceRanges.value

    let filter = wixData.filter()

    if (selectedSize) {
        // FIXME: This should be refactored to use just eq by transforming "tallas" into an array 
        filter = filter.and(
            wixData.filter()
                .contains("tallas", ` ${selectedSize} `) // Add spaces to ensure exact match
                .or(wixData.filter().startsWith("tallas", `${selectedSize} `)) // Match at the start
                .or(wixData.filter().endsWith("tallas", ` ${selectedSize}`)) // Match at the end
                .or(wixData.filter().eq("tallas", selectedSize)) // Exact match
        )
    }
    if (selectedBrand) {
        filter = filter.contains("nombre", selectedBrand)
    }
    if (selectedPriceRange) {
        filter = addPriceFilter(selectedPriceRange, filter)
    }

    currentPage = 0
    productDataset.setFilter(filter)
        .then(() => loadCurrentPage())
        .catch((error) => console.error("Error applying filters:", error))        
}

function loadCurrentPage() {
    const productDataset = $w('#productDataset')
    productDataset.getItems(currentPage * itemsPerPage, itemsPerPage)
        .then((result) => {
            $w('#repeater1').data = result.items
            hasMoreItems = result.items.length === itemsPerPage
            updatePaginationCotrols()
        })
        .catch((error) => console.error("Error loading current page:", error))
}

function loadNextPage() {
    if (hasMoreItems) {
        currentPage++
        loadCurrentPage()
    }
}

function loadPrevPage() {
    if (currentPage > 0) {
        currentPage--
        loadCurrentPage()
    }
}

function updatePaginationCotrols() {  
    $w('#prevPageTop').enable()
    $w('#prevPageBottom').enable()
    $w('#nextPageTop').enable()
    $w('#nextPageBottom').enable()

    if (currentPage === 0) {
        $w('#prevPageTop').disable()
        $w('#prevPageBottom').disable()
    }
    if (!hasMoreItems) {
        $w('#nextPageTop').disable()
        $w('#nextPageBottom').disable()
    }
}


function generatePriceRanges(price) {
    const ranges = [
        { upperLimit: 200, range: "Hasta S/ 200", order: 1},
        { upperLimit: 300, range: "S/ 200 - S/ 300", order: 2},
        { upperLimit: 400, range: "S/ 300 - S/ 400", order: 3},
        { upperLimit: Infinity, range: "De S/ 400 a más", order: 4},
    ]
    const priceObject = ranges.find(range => price <= range.upperLimit)
    return { price: price, range: priceObject.range, order: priceObject.order }
}

function addPriceFilter(priceRange, currentFilter) {
    switch (priceRange) {
        case "Hasta S/ 200":
            return currentFilter.le("price", 200);
        case "S/ 200 - S/ 300":
            return currentFilter.ge("price", 200).le("price", 300);
        case "S/ 300 - S/ 400":
            return currentFilter.ge("price", 300).le("price", 400);
        case "De S/ 400 a más":
            return currentFilter.ge("price", 400);
        default:
            return currentFilter;
    }
}

function focusOnFilters() {
    $w('#section3').scrollTo()
}

function configureWhatsappIntegration() {
    const phoneNumber = "51997276313"
    $w('#repeater1').onItemReady(($item, itemData) => {
        const imageElement = $item("#image5")
        const productName = itemData.nombre

        imageElement.onClick(() => {
            const message = `¡Hola! Estoy interesado en el producto ${productName}. ¿Podrías proporcionarme más información?`;
            const encodedMessage = encodeURIComponent(message);
            const whatsappLink = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
            wixLocation.to(whatsappLink);
        })
    })
}