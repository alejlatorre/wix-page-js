// Referencia de la API de Velo: https://www.wix.com/velo/reference/api-overview/introduction
import wixData from 'wix-data';
import wixLocation from 'wix-location';

$w.onReady(function () {
    initializeDropdowns()
    configureWhatsappIntegration()
})

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
        filter = filter.contains("tallas", selectedSize)
    }
    if (selectedBrand) {
        filter = filter.contains("nombre", selectedBrand)
    }
    if (selectedPriceRange) {
        filter = addPriceFilter(selectedPriceRange, filter)
    }

    productDataset.setFilter(filter)
        .then(() => productDataset.getItems(0, 1000))
        .catch((error) => console.error("Error applying filters:", error))
}

function generatePriceRanges(price) {
    const ranges = [
        { upperLimit: 200, range: "Hasta S/ 200", order: 1},
        { upperLimit: 300, range: "S/ 200 - S/ 300", order: 2},
        { upperLimit: 400, range: "S/ 300 - S/ 400", order: 3},
        { upperLimit: Infinity, range: "De S/ 400 a mas", order: 4},
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